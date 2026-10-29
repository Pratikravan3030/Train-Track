import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'restore');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const drive = await Drive.findOne({ _id: id, isDeleted: true });
    if (!drive) {
      return NextResponse.json(
        { error: 'Soft-deleted placement drive not found' },
        { status: 404 }
      );
    }

    drive.isDeleted = false;
    drive.deletedAt = null;
    drive.deletedBy = null;
    await drive.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'RESTORE_DRIVE',
      resource: 'Drive',
      resourceId: id,
      details: { role: drive.role, company: drive.company?.toString() },
    });

    return NextResponse.json(
      { message: 'Placement drive restored successfully', drive },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/drives/[id]/restore error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
