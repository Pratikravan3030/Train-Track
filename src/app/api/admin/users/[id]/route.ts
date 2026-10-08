import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { updateUserSchema } from '@/lib/validations/user';
import { mapToDepartmentCode } from '@/lib/departmentMapper';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('users', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = updateUserSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    await dbConnect();
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Safety constraint: Super Admin cannot deactivate themselves
    if (auth.user.id === id && parseResult.data.isActive === false) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own administrator account.' },
        { status: 400 }
      );
    }

    const { name, role, department, isActive } = parseResult.data;

    let deptCode: string | undefined = undefined;
    if (department !== undefined) {
      if (department) {
        const mapped = mapToDepartmentCode(department);
        if (!mapped) {
          return NextResponse.json(
            { error: `Invalid department code: "${department}"` },
            { status: 400 }
          );
        }
        deptCode = mapped;
      } else {
        deptCode = undefined;
      }
    }

    const previousStatus = targetUser.isActive;

    if (name !== undefined) targetUser.name = name;
    if (role !== undefined) targetUser.role = role;
    if (department !== undefined) targetUser.department = deptCode;
    if (isActive !== undefined) {
      if (isActive !== previousStatus) {
        targetUser.tokenVersion = (targetUser.tokenVersion || 1) + 1;
      }
      targetUser.isActive = isActive;
    }

    await targetUser.save();

    const isStatusToggle = isActive !== undefined && isActive !== previousStatus;
    const actionName = isStatusToggle
      ? isActive
        ? 'REACTIVATE_USER'
        : 'DEACTIVATE_USER'
      : 'UPDATE_USER';

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: actionName,
      resource: 'User',
      resourceId: id,
      details: {
        targetEmail: targetUser.email,
        isActive: targetUser.isActive,
        role: targetUser.role,
      },
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        _id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        department: targetUser.department,
        isActive: targetUser.isActive,
        mustChangePassword: targetUser.mustChangePassword,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[PUT /api/admin/users/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('users', 'delete');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    if (auth.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own administrator account.' },
        { status: 400 }
      );
    }

    await dbConnect();
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_USER',
      resource: 'User',
      resourceId: id,
      details: { deletedEmail: deletedUser.email, role: deletedUser.role },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[DELETE /api/admin/users/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
