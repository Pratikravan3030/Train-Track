import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/models/Company';
import Drive from '@/models/Drive';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { createCompanySchema, companyQuerySchema } from '@/lib/validations/company';

export async function GET(request: Request) {
  const auth = await requirePermission('companies', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = companyQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { page, limit, search, sector, includeArchived } = parseResult.data;
    await dbConnect();

    const filter: Record<string, unknown> = {};

    if (includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
    }

    if (sector) {
      filter.sector = sector;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: searchRegex }, { sector: searchRegex }, { notes: searchRegex }];
    }

    const skip = (page - 1) * limit;

    const [total, rawCompanies] = await Promise.all([
      Company.countDocuments(filter),
      Company.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    ]);

    // Derive drive statistics per company
    const companyIds = rawCompanies.map((c) => c._id);
    const driveAggs = await Drive.aggregate([
      { $match: { company: { $in: companyIds } } },
      {
        $group: {
          _id: '$company',
          driveCount: { $sum: 1 },
          mostRecentDriveDate: { $max: '$driveDate' },
        },
      },
    ]);

    const driveStatsMap = new Map<string, { driveCount: number; mostRecentDriveDate?: Date }>();
    for (const agg of driveAggs) {
      driveStatsMap.set(String(agg._id), {
        driveCount: agg.driveCount,
        mostRecentDriveDate: agg.mostRecentDriveDate,
      });
    }

    // Role-based scoping: Hide HR contacts from DEPT_COORDINATOR
    const isCoordinator = auth.user.role === 'DEPT_COORDINATOR';

    const companies = rawCompanies.map((c) => {
      const stats = driveStatsMap.get(String(c._id)) || { driveCount: 0 };
      return {
        _id: c._id,
        name: c.name,
        sector: c.sector,
        website: c.website,
        // HR contact details strictly hidden from coordinators
        hrContacts: isCoordinator ? [] : c.hrContacts || [],
        hrContactsCount: (c.hrContacts || []).length,
        preSystemHistory: c.preSystemHistory,
        notes: c.notes,
        isArchived: c.isArchived || false,
        driveCount: stats.driveCount,
        mostRecentDriveDate: stats.mostRecentDriveDate || null,
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({
      data: companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/companies error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('companies', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const parseResult = createCompanySchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { name, sector, website, hrContacts, preSystemHistory, notes } = parseResult.data;
    await dbConnect();

    const normalizedName = name.trim().toLowerCase();
    const existing = await Company.findOne({ normalizedName });
    if (existing) {
      return NextResponse.json(
        { error: `Company with name "${name}" already exists.` },
        { status: 409 }
      );
    }

    const company = await Company.create({
      name: name.trim(),
      normalizedName,
      sector: sector.trim(),
      website: website || undefined,
      hrContacts: hrContacts || [],
      preSystemHistory: preSystemHistory || undefined,
      notes: notes || undefined,
      isArchived: false,
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_COMPANY',
      resource: 'Company',
      resourceId: company._id.toString(),
      details: { name: company.name, sector: company.sector },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/companies error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
