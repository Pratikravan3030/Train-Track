import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('sessions', 'restore');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const session = await TrainingSession.findOne({ _id: id, isDeleted: true });
    if (!session) {
      return NextResponse.json(
        { error: 'Soft-deleted training session not found' },
        { status: 404 }
      );
    }

    session.isDeleted = false;
    session.deletedAt = null;
    session.deletedBy = null;
    await session.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'RESTORE_SESSION',
      resource: 'TrainingSession',
      resourceId: id,
      details: { title: session.title },
    });

    return NextResponse.json(
      { message: 'Training session restored successfully', session },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/sessions/[id]/restore error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
