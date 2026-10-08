import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Offer from '@/models/Offer';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { createManualOfferSchema, offerQuerySchema } from '@/lib/validations/offer';
import { evaluatePlacementPolicyCompliance } from '@/lib/placementPolicy';
import { resolveOfferTier } from '@/config/collegeConfig';
import { syncStudentPlacementStatusFromOffers } from '@/lib/offerSync';

export async function GET(request: Request) {
  const auth = await requirePermission('offers', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = offerQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { page, limit, studentId, driveId, status, type, batch } = parseResult.data;
    await dbConnect();

    const filter: Record<string, unknown> = {};

    if (studentId) filter.student = studentId;
    if (driveId) filter.drive = driveId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Role-based department scoping for DEPT_COORDINATOR
    if (auth.user.role === 'DEPT_COORDINATOR') {
      const deptStudentIds = await Student.find({ department: auth.user.department }).distinct('_id');
      filter.student = filter.student
        ? { $in: [filter.student, ...deptStudentIds].filter((s) => deptStudentIds.some((ds) => String(ds) === String(s))) }
        : { $in: deptStudentIds };
    }

    // Batch filtering via Student
    if (batch) {
      const batchStudentIds = await Student.find({ passoutYear: batch }).distinct('_id');
      if (filter.student) {
        const existingList = Array.isArray((filter.student as Record<string, unknown>).$in)
          ? ((filter.student as Record<string, unknown>).$in as mongoose.Types.ObjectId[])
          : [filter.student as mongoose.Types.ObjectId];
        const batchSet = new Set(batchStudentIds.map(String));
        filter.student = { $in: existingList.filter((sid) => batchSet.has(String(sid))) };
      } else {
        filter.student = { $in: batchStudentIds };
      }
    }

    const skip = (page - 1) * limit;

    const [total, offers] = await Promise.all([
      Offer.countDocuments(filter),
      Offer.find(filter)
        .populate('student', 'name rollNumber prn department passoutYear cgpa placementStatus')
        .populate('drive', 'role type driveDate')
        .sort({ offerDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      data: offers,
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
    console.error('[GET /api/offers error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('offers', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const parseResult = createManualOfferSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const data = parseResult.data;
    await dbConnect();

    const student = await Student.findById(data.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const tier = data.tier || resolveOfferTier(data.ctcLpa);

    // Placement policy compliance check
    const rawOffers = await Offer.find({ student: student._id }).lean();
    const existingOffers = rawOffers.map((o) => ({
      role: o.role,
      companyName: o.companyName,
      type: o.type,
      ctcLpa: o.ctcLpa,
      tier: o.tier,
      status: o.status,
    }));

    const policyCheck = evaluatePlacementPolicyCompliance({
      existingOffers,
      targetTier: tier,
      targetCtcLpa: data.ctcLpa,
    });

    if (!policyCheck.compliant && !data.overrideReason) {
      return NextResponse.json(
        {
          error: `Cannot issue manual offer due to placement policy: ${policyCheck.violationReason}. Staff override reason is required.`,
          policyCheck,
        },
        { status: 400 }
      );
    }

    const offer = await Offer.create({
      student: student._id,
      source: 'Off-Campus / Manual',
      companyName: data.companyName.trim(),
      role: data.role.trim(),
      type: data.type,
      ctcLpa: data.ctcLpa,
      stipendMonthly: data.stipendMonthly,
      tier,
      status: data.status,
      offerDate: data.offerDate || new Date(),
      joiningDate: data.joiningDate,
      placementStatusSync: {
        status: data.status === 'Accepted' ? 'Confirmed' : 'None',
        confirmedAt: data.status === 'Accepted' ? new Date() : undefined,
        confirmedBy: data.status === 'Accepted' ? new mongoose.Types.ObjectId(auth.user.id) : undefined,
      },
      policyOverride: {
        hasOverride: Boolean(data.overrideReason),
        reason: data.overrideReason || undefined,
        overriddenBy: data.overrideReason ? new mongoose.Types.ObjectId(auth.user.id) : undefined,
        overriddenAt: data.overrideReason ? new Date() : undefined,
      },
    });

    if (data.status === 'Accepted') {
      await syncStudentPlacementStatusFromOffers(student._id);
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_MANUAL_OFFER',
      resource: 'Offer',
      resourceId: offer._id.toString(),
      details: {
        studentId: student._id.toString(),
        studentRoll: student.rollNumber,
        companyName: data.companyName,
        role: data.role,
        ctcLpa: data.ctcLpa,
        type: data.type,
        status: data.status,
        isOverride: Boolean(data.overrideReason),
      },
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/offers error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
