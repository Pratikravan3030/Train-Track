import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { changePasswordSchema } from '@/lib/validations/user';

export async function POST(request: Request) {
  const auth = await requireAuth(undefined, { allowPasswordChangePending: true });
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parseResult = changePasswordSchema.safeParse(json);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { currentPassword, newPassword } = parseResult.data;
    await dbConnect();

    const userDoc = await User.findById(auth.user.id);
    if (!userDoc) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // 1. Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, userDoc.password);
    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // 2. Prevent reuse of current password
    const isSameAsCurrent = await bcrypt.compare(newPassword, userDoc.password);
    if (isSameAsCurrent) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      );
    }

    // 3. Enforce no reuse of temporary password
    if (userDoc.temporaryPasswordHash) {
      const isSameAsTemp = await bcrypt.compare(newPassword, userDoc.temporaryPasswordHash);
      if (isSameAsTemp) {
        return NextResponse.json(
          { error: 'New password cannot be the temporary password. Please choose a new unique password.' },
          { status: 400 }
        );
      }
    }

    // 4. Update password and clear temporary flags
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    userDoc.password = hashedPassword;
    userDoc.mustChangePassword = false;
    userDoc.temporaryPasswordHash = undefined;
    userDoc.tokenVersion = (userDoc.tokenVersion || 1) + 1;
    await userDoc.save();

    await logAudit({
      userId: userDoc._id,
      userEmail: userDoc.email,
      userRole: userDoc.role,
      action: 'CHANGE_PASSWORD',
      resource: 'User',
      resourceId: userDoc._id.toString(),
    });

    return NextResponse.json(
      {
        message: 'Password updated successfully',
        tokenVersion: userDoc.tokenVersion,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[POST /api/auth/change-password error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
