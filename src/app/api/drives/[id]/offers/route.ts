import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import Student from '@/models/Student';
import Offer from '@/models/Offer';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { createDriveOfferSchema } from '@/lib/validations/offer';
import { evaluatePlacementPolicyCompliance } from '@/lib/placementPolicy';
import { resolveOfferTier } from '@/config/collegeConfig';
import { syncStudentPlacementStatusFromOffers } from '@/lib/offerSync';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const drive = await Drive.findById(id).lean();
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const filter: Record<string, unknown> = { drive: id };

    // Role-based department scoping for DEPT_COORDINATOR
    if (auth.user.role === 'DEPT_COORDINATOR') {
      const deptStudentIds = await Student.find({ department: auth.user.department }).distinct('_id');
      filter.student = { $in: deptStudentIds };
    }

    const offers = await Offer.find(filter)
      .populate('student', 'name rollNumber prn department passoutYear cgpa placementStatus')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ data: offers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/drives/[id]/offers error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = createDriveOfferSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const data = parseResult.data;
    await dbConnect();

    const drive = await Drive.findById(id).populate('company');
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const student = await Student.findById(data.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Verify student has an application for this drive
    const application = await Application.findOne({ drive: id, student: data.studentId });
    if (!application) {
      return NextResponse.json(
        { error: 'Student has not registered for this drive. Please register first.' },
        { status: 400 }
      );
    }

    // Determine CTC and Tier
    const ctcLpa = data.ctcLpa !== undefined ? data.ctcLpa : drive.ctcLpa;
    const tier = data.tier || resolveOfferTier(ctcLpa);
    const role = data.role || drive.role;
    const companyName =
      drive.company && typeof drive.company === 'object' && 'name' in drive.company
        ? (drive.company as { name: string }).name
        : 'Unknown Company';

    // Policy Compliance Check on Offer Creation
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
      targetCtcLpa: ctcLpa,
    });

    if (!policyCheck.compliant && !data.overrideReason) {
      return NextResponse.json(
        {
          error: `Cannot issue offer due to placement policy: ${policyCheck.violationReason}. Staff override reason is required.`,
          policyCheck,
        },
        { status: 400 }
      );
    }

    const offer = await Offer.create({
      application: application._id,
      drive: drive._id,
      student: student._id,
      source: 'Campus Drive',
      companyName,
      role,
      type: data.type,
      ctcLpa,
      stipendMonthly: data.stipendMonthly !== undefined ? data.stipendMonthly : drive.stipendMonthly,
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

    // Update Application status if offer accepted
    if (data.status === 'Accepted') {
      application.status = 'Selected';
      application.statusHistory.push({
        status: 'Selected',
        roundIndex: application.currentRoundIndex,
        changedBy: new mongoose.Types.ObjectId(auth.user.id),
        reason: 'Offer accepted from campus placement drive',
        changedAt: new Date(),
      });
      await application.save();

      // Synchronize Student placementStatus and placementDetails cache
      await syncStudentPlacementStatusFromOffers(student._id);
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_DRIVE_OFFER',
      resource: 'Offer',
      resourceId: offer._id.toString(),
      details: {
        driveId: drive._id.toString(),
        studentId: student._id.toString(),
        studentRoll: student.rollNumber,
        companyName,
        role,
        ctcLpa,
        type: data.type,
        status: data.status,
        isOverride: Boolean(data.overrideReason),
      },
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/drives/[id]/offers error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
