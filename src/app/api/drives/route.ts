import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { createDriveSchema, driveQuerySchema } from '@/lib/validations/drive';
import { DEFAULT_PASSOUT_YEAR, resolveOfferTier } from '@/config/collegeConfig';

export async function GET(request: Request) {
  const auth = await requirePermission('drives', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = driveQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { page, limit, search, batch, companyId, status, type, includeArchived } = parseResult.data;
    await dbConnect();

    const targetBatch = batch || DEFAULT_PASSOUT_YEAR;
    const filter: Record<string, unknown> = {};

    if (includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
    }

    // Cohort batch isolation: drive must include targetBatch in allowedBatches or have empty allowedBatches (all batches allowed)
    filter.$or = [
      { 'eligibilityRules.allowedBatches': targetBatch },
      { 'eligibilityRules.allowedBatches': { $size: 0 } },
      { 'eligibilityRules.allowedBatches': { $exists: false } },
    ];

    if (companyId) filter.company = companyId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [
        ...(filter.$and as Array<Record<string, unknown>> || []),
        { $or: [{ role: searchRegex }, { location: searchRegex }] },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, rawDrives] = await Promise.all([
      Drive.countDocuments(filter),
      Drive.find(filter)
        .populate('company', 'name sector website isArchived')
        .sort({ driveDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const driveIds = rawDrives.map((d) => d._id);

    // Get applicant counts per drive
    const appCounts = await Application.aggregate([
      { $match: { drive: { $in: driveIds } } },
      { $group: { _id: '$drive', count: { $sum: 1 } } },
    ]);
    const appCountMap = new Map<string, number>();
    for (const c of appCounts) {
      appCountMap.set(String(c._id), c.count);
    }

    const now = new Date();

    const drives = rawDrives.map((d) => {
      let displayStatus = d.status;
      // Dynamically compute "Registration Closed" on read if past deadline
      if (d.status === 'Open' && now.getTime() > new Date(d.registrationDeadline).getTime()) {
        displayStatus = 'Registration Closed';
      }

      const tier = d.tier || resolveOfferTier(d.ctcLpa);

      return {
        _id: d._id,
        company: d.company,
        role: d.role,
        type: d.type,
        jd: d.jd,
        ctcLpa: d.ctcLpa,
        stipendMonthly: d.stipendMonthly,
        tier,
        location: d.location,
        mode: d.mode,
        driveDate: d.driveDate,
        registrationDeadline: d.registrationDeadline,
        selectionRounds: d.selectionRounds,
        eligibilityRules: d.eligibilityRules,
        status: d.status,
        displayStatus,
        isRegistrationClosed: now.getTime() > new Date(d.registrationDeadline).getTime(),
        applicantCount: appCountMap.get(String(d._id)) || 0,
        isArchived: d.isArchived || false,
        createdAt: d.createdAt,
      };
    });

    return NextResponse.json({
      data: drives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      currentBatch: targetBatch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/drives error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('drives', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const parseResult = createDriveSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const data = parseResult.data;
    await dbConnect();

    const tier = data.tier || resolveOfferTier(data.ctcLpa);

    const drive = await Drive.create({
      ...data,
      tier,
      isArchived: false,
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_DRIVE',
      resource: 'Drive',
      resourceId: drive._id.toString(),
      details: { role: drive.role, company: data.company, driveDate: drive.driveDate },
    });

    return NextResponse.json(drive, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/drives error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
