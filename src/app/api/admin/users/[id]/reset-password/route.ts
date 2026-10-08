import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pass = 'Ab1!';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return pass;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('users', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    await dbConnect();
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    targetUser.password = hashedPassword;
    targetUser.temporaryPasswordHash = hashedPassword;
    targetUser.mustChangePassword = true;
    targetUser.tokenVersion = (targetUser.tokenVersion || 1) + 1;
    await targetUser.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'RESET_USER_PASSWORD',
      resource: 'User',
      resourceId: id,
      details: { targetEmail: targetUser.email },
    });

    return NextResponse.json({
      message: 'Temporary password generated successfully',
      temporaryPassword,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[POST /api/admin/users/[id]/reset-password error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
