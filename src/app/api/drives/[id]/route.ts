import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { updateDriveSchema } from '@/lib/validations/drive';
import { resolveOfferTier } from '@/config/collegeConfig';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const drive = await Drive.findById(id)
      .populate('company', 'name sector website hrContacts isArchived')
      .lean();

    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const now = new Date();
    let displayStatus = drive.status;
    if (drive.status === 'Open' && now.getTime() > new Date(drive.registrationDeadline).getTime()) {
      displayStatus = 'Registration Closed';
    }

    // Role-based scoping: Hide company HR contacts from DEPT_COORDINATOR
    const isCoordinator = auth.user.role === 'DEPT_COORDINATOR';
    if (isCoordinator && drive.company && typeof drive.company === 'object') {
      (drive.company as Record<string, unknown>).hrContacts = [];
    }

    const applicantCount = await Application.countDocuments({ drive: id });

    return NextResponse.json({
      ...drive,
      tier: drive.tier || resolveOfferTier(drive.ctcLpa),
      displayStatus,
      isRegistrationClosed: now.getTime() > new Date(drive.registrationDeadline).getTime(),
      applicantCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/drives/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = updateDriveSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    await dbConnect();
    const drive = await Drive.findById(id);
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const data = parseResult.data;

    // Cross-field deadline check against existing drive values if only one is updated
    const finalDriveDate = data.driveDate ? new Date(data.driveDate) : drive.driveDate;
    const finalDeadline = data.registrationDeadline ? new Date(data.registrationDeadline) : drive.registrationDeadline;
    if (finalDeadline.getTime() >= finalDriveDate.getTime()) {
      return NextResponse.json(
        { error: 'Registration deadline must be strictly before the drive date.' },
        { status: 400 }
      );
    }

    if (data.company !== undefined) drive.company = data.company as unknown as typeof drive.company;
    if (data.role !== undefined) drive.role = data.role;
    if (data.type !== undefined) drive.type = data.type;
    if (data.jd !== undefined) drive.jd = data.jd;
    if (data.ctcLpa !== undefined) {
      drive.ctcLpa = data.ctcLpa;
      if (data.tier === undefined) {
        drive.tier = resolveOfferTier(data.ctcLpa);
      }
    }
    if (data.stipendMonthly !== undefined) drive.stipendMonthly = data.stipendMonthly;
    if (data.tier !== undefined) drive.tier = data.tier;
    if (data.location !== undefined) drive.location = data.location;
    if (data.mode !== undefined) drive.mode = data.mode;
    if (data.driveDate !== undefined) drive.driveDate = data.driveDate;
    if (data.registrationDeadline !== undefined) drive.registrationDeadline = data.registrationDeadline;
    if (data.bondNotes !== undefined) drive.bondNotes = data.bondNotes;
    if (data.selectionRounds !== undefined) drive.selectionRounds = data.selectionRounds;
    if (data.eligibilityRules !== undefined) drive.eligibilityRules = data.eligibilityRules;
    if (data.status !== undefined) drive.status = data.status;
    if (data.isArchived !== undefined) drive.isArchived = data.isArchived;

    await drive.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_DRIVE',
      resource: 'Drive',
      resourceId: id,
      details: { role: drive.role, status: drive.status, isArchived: drive.isArchived },
    });

    return NextResponse.json(drive);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PUT /api/drives/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'delete');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const drive = await Drive.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const applicationsCount = await Application.countDocuments({ drive: id });
    if (applicationsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete drive with registered applications (${applicationsCount} applications found). Archive the drive instead.`,
        },
        { status: 409 }
      );
    }

    // Soft delete: flag record
    drive.isDeleted = true;
    drive.deletedAt = new Date();
    drive.deletedBy = auth.user.id;
    await drive.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_DRIVE',
      resource: 'Drive',
      resourceId: id,
      details: { role: drive.role, company: drive.company?.toString(), softDelete: true },
    });

    return NextResponse.json({ message: 'Drive soft deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/drives/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
