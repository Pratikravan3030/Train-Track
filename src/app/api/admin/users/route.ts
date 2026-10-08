import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { createUserSchema } from '@/lib/validations/user';
import { mapToDepartmentCode } from '@/lib/departmentMapper';

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pass = '';
  // Ensure at least 1 uppercase, 1 lowercase, 1 number, 1 special
  pass += 'Ab1!';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return pass;
}

export async function GET(request: Request) {
  const auth = await requirePermission('users', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const role = searchParams.get('role')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)));
    const skip = (page - 1) * limit;

    await dbConnect();

    const filter: Record<string, unknown> = {};
    if (role && role !== 'all') {
      filter.role = role;
    }
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      filter.$or = [{ name: regex }, { email: regex }, { department: regex }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password -temporaryPasswordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[GET /api/admin/users error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('users', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parseResult = createUserSchema.safeParse(json);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { name, email, role, department } = parseResult.data;
    await dbConnect();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: `A user account with email "${email}" already exists.` },
        { status: 409 }
      );
    }

    let deptCode: string | undefined = undefined;
    if (role === 'DEPT_COORDINATOR' && department) {
      const mapped = mapToDepartmentCode(department);
      if (!mapped) {
        return NextResponse.json(
          { error: `Invalid department code or name: "${department}".` },
          { status: 400 }
        );
      }
      deptCode = mapped;
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const newUser = await User.create({
      name,
      email,
      role,
      department: deptCode,
      password: hashedPassword,
      temporaryPasswordHash: hashedPassword,
      mustChangePassword: true,
      isActive: true,
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_USER',
      resource: 'User',
      resourceId: newUser._id.toString(),
      details: { email, role, department: deptCode },
    });

    return NextResponse.json(
      {
        user: {
          _id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          department: newUser.department,
          isActive: newUser.isActive,
          mustChangePassword: newUser.mustChangePassword,
          createdAt: newUser.createdAt,
        },
        temporaryPassword, // Shown once in modal to Super Admin
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[POST /api/admin/users error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
