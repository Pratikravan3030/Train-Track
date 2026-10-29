import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/models/Company';
import Drive from '@/models/Drive';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { updateCompanySchema } from '@/lib/validations/company';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('companies', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const company = await Company.findById(id).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const drives = await Drive.find({ company: id })
      .select('role type driveDate status ctcLpa stipendMonthly mode isArchived')
      .sort({ driveDate: -1 })
      .lean();

    const isCoordinator = auth.user.role === 'DEPT_COORDINATOR';

    const companyResponse = {
      ...company,
      hrContacts: isCoordinator ? [] : company.hrContacts || [],
      hrContactsCount: (company.hrContacts || []).length,
      drives,
    };

    return NextResponse.json(companyResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/companies/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('companies', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = updateCompanySchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    await dbConnect();
    const company = await Company.findById(id);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { name, sector, website, hrContacts, preSystemHistory, notes, isArchived } = parseResult.data;

    if (name && name.trim().toLowerCase() !== company.normalizedName) {
      const normalizedName = name.trim().toLowerCase();
      const duplicate = await Company.findOne({ normalizedName, _id: { $ne: id } });
      if (duplicate) {
        return NextResponse.json(
          { error: `Company with name "${name}" already exists.` },
          { status: 409 }
        );
      }
      company.name = name.trim();
      company.normalizedName = normalizedName;
    }

    if (sector !== undefined) company.sector = sector.trim();
    if (website !== undefined) company.website = website || undefined;
    if (hrContacts !== undefined) company.hrContacts = hrContacts;
    if (preSystemHistory !== undefined) company.preSystemHistory = preSystemHistory || undefined;
    if (notes !== undefined) company.notes = notes || undefined;
    if (isArchived !== undefined) company.isArchived = isArchived;

    await company.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_COMPANY',
      resource: 'Company',
      resourceId: id,
      details: { name: company.name, isArchived: company.isArchived },
    });

    return NextResponse.json(company);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PUT /api/companies/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('companies', 'delete');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const company = await Company.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check if non-deleted drives exist for this company
    const drivesCount = await Drive.countDocuments({ company: id, isDeleted: { $ne: true } });
    if (drivesCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete company with active or historical placement drives (${drivesCount} drives found). Archive the company instead.`,
        },
        { status: 409 }
      );
    }

    // Soft delete: flag record
    company.isDeleted = true;
    company.deletedAt = new Date();
    company.deletedBy = auth.user.id;
    await company.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_COMPANY',
      resource: 'Company',
      resourceId: id,
      details: { name: company.name, softDelete: true },
    });

    return NextResponse.json({ message: 'Company soft deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/companies/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
