import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/models/Company';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('companies', 'restore');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const company = await Company.findOne({ _id: id, isDeleted: true });
    if (!company) {
      return NextResponse.json(
        { error: 'Soft-deleted company not found' },
        { status: 404 }
      );
    }

    company.isDeleted = false;
    company.deletedAt = null;
    company.deletedBy = null;
    await company.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'RESTORE_COMPANY',
      resource: 'Company',
      resourceId: id,
      details: { name: company.name },
    });

    return NextResponse.json(
      { message: 'Company restored successfully', company },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/companies/[id]/restore error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
