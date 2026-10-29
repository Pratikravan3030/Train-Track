import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

function generateRandomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('sessions', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const durationMinutes = Math.max(1, Math.min(180, parseInt(body.durationMinutes || '15', 10)));

    await dbConnect();
    const session = await TrainingSession.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!session) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    const code = generateRandomCode(6);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    session.checkInCode = code;
    session.checkInCodeExpiresAt = expiresAt;
    await session.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'GENERATE_CHECK_IN_CODE',
      resource: 'TrainingSession',
      resourceId: id,
      details: { durationMinutes, expiresAt },
    });

    return NextResponse.json({
      checkInCode: code,
      expiresAt: expiresAt.toISOString(),
      durationMinutes,
      message: `Check-in code active for ${durationMinutes} minutes.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/sessions/[id]/check-in-code error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
