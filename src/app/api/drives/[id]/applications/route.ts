import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Student from '@/models/Student';
import Application from '@/models/Application';
import Offer from '@/models/Offer';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { registerDriveApplicationSchema } from '@/lib/validations/drive';
import { evaluateStudentEligibility, isDriveRegistrationOpen } from '@/lib/eligibilityEngine';
import { evaluatePlacementPolicyCompliance } from '@/lib/placementPolicy';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('applications', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const url = new URL(request.url);

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    await dbConnect();

    const drive = await Drive.findById(id).lean();
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const filter: Record<string, unknown> = { drive: id };
    if (status) {
      filter.status = status;
    }

    // Role-based department scoping for DEPT_COORDINATOR
    if (auth.user.role === 'DEPT_COORDINATOR') {
      const deptStudentIds = await Student.find({ department: auth.user.department })
        .distinct('_id');
      filter.student = { $in: deptStudentIds };
    }

    // If search is provided, filter by student name / roll / prn
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchStudentIds = await Student.find({
        $or: [{ name: searchRegex }, { rollNumber: searchRegex }, { prn: searchRegex }],
      }).distinct('_id');

      if (filter.student) {
        // Intersect with existing department restriction
        const existingIds = (filter.student as { $in: mongoose.Types.ObjectId[] }).$in;
        const setA = new Set(existingIds.map(String));
        const intersected = searchStudentIds.filter((sid) => setA.has(String(sid)));
        filter.student = { $in: intersected };
      } else {
        filter.student = { $in: searchStudentIds };
      }
    }

    const skip = (page - 1) * limit;

    const [total, applications] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter)
        .populate('student', 'name rollNumber prn department passoutYear cgpa backlogs placementStatus resume')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      data: applications,
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
    console.error('[GET /api/drives/[id]/applications error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('applications', 'register');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = registerDriveApplicationSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { studentId, studentIds, lateRegistrationReason, overrideReason } = parseResult.data;
    const rawTargetIds = studentIds && studentIds.length > 0 ? studentIds : (studentId ? [studentId] : []);
    const targetStudentIds = Array.from(new Set(rawTargetIds.map(String)));

    await dbConnect();

    const drive = await Drive.findById(id);
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    // Check if registration is open
    const openStatus = isDriveRegistrationOpen(drive);
    const isLate = !openStatus.isOpen;
    if (isLate && !lateRegistrationReason) {
      return NextResponse.json(
        {
          error: `${openStatus.reason} A late registration reason is required to proceed.`,
        },
        { status: 400 }
      );
    }

    // Fetch students
    const students = await Student.find({ _id: { $in: targetStudentIds } });
    if (students.length === 0) {
      return NextResponse.json({ error: 'No matching students found' }, { status: 404 });
    }

    const results: Array<{
      studentId: string;
      studentName: string;
      status: 'created' | 'skipped' | 'error';
      reason?: string;
    }> = [];

    const createdApplications: unknown[] = [];

    for (const student of students) {
      // 1. Check if already registered
      const existingApp = await Application.findOne({ drive: id, student: student._id });
      if (existingApp) {
        results.push({
          studentId: student._id.toString(),
          studentName: student.name,
          status: 'skipped',
          reason: 'Already registered for this drive',
        });
        continue;
      }

      // 2. Evaluate academic eligibility
      const evalResult = evaluateStudentEligibility(student, drive.eligibilityRules);
      if (!evalResult.isEligible && !overrideReason) {
        if (targetStudentIds.length === 1) {
          return NextResponse.json(
            {
              error: `Student ${student.name} (${student.rollNumber}) is ineligible: ${evalResult.reasons.join('; ')}. Staff override reason is required.`,
              reasons: evalResult.reasons,
              missingFields: evalResult.missingFields,
            },
            { status: 400 }
          );
        }
        results.push({
          studentId: student._id.toString(),
          studentName: student.name,
          status: 'error',
          reason: `Ineligible: ${evalResult.reasons.join('; ')}`,
        });
        continue;
      }

      // 3. Evaluate placement policy compliance (offer tier upgrades, offer limits)
      const rawOffers = await Offer.find({ student: student._id }).lean();
      const existingOffers = rawOffers.map((o) => ({
        role: o.role,
        type: o.type,
        ctcLpa: o.ctcLpa,
        tier: o.tier,
        status: o.status,
      }));
      const policyResult = evaluatePlacementPolicyCompliance({
        existingOffers,
        targetTier: drive.tier,
        targetCtcLpa: drive.ctcLpa,
      });

      if (!policyResult.compliant && !overrideReason) {
        if (targetStudentIds.length === 1) {
          return NextResponse.json(
            {
              error: `Student ${student.name} cannot register due to placement policy: ${policyResult.violationReason}. Staff override reason is required.`,
              policyCheck: policyResult,
            },
            { status: 400 }
          );
        }
        results.push({
          studentId: student._id.toString(),
          studentName: student.name,
          status: 'error',
          reason: `Policy violation: ${policyResult.violationReason}`,
        });
        continue;
      }

      // 4. Initialize rounds from drive selection rounds
      const selectionRounds = drive.selectionRounds && drive.selectionRounds.length > 0
        ? drive.selectionRounds
        : ['Round 1'];

      const initialRounds = selectionRounds.map((name: string, index: number) => ({
        roundIndex: index,
        roundName: name,
        status: 'Pending',
        updatedBy: new mongoose.Types.ObjectId(auth.user.id),
        updatedAt: new Date(),
      }));

      const changeReason = isLate
        ? `Late registration: ${lateRegistrationReason}`
        : overrideReason
        ? `Override: ${overrideReason}`
        : 'Registered for drive';

      try {
        const app = await Application.create({
          drive: drive._id,
          student: student._id,
          status: 'Applied',
          currentRoundIndex: 0,
          roundResults: initialRounds,
          statusHistory: [
            {
              status: 'Applied',
              roundIndex: 0,
              changedBy: new mongoose.Types.ObjectId(auth.user.id),
              reason: changeReason,
              changedAt: new Date(),
            },
          ],
          eligibilitySnapshot: {
            isEligible: evalResult.isEligible,
            ineligibilityReasons: evalResult.reasons,
            cgpa: student.cgpa ?? null,
            backlogs: student.backlogs ?? null,
            tenthPercentage: student.tenthPercentage ?? null,
            twelfthOrDiplomaPercentage: student.twelfthOrDiplomaPercentage ?? null,
            department: student.department,
            passoutYear: student.passoutYear,
            evaluatedAt: new Date(),
            policyCheck: {
              passesPolicy: policyResult.compliant,
              warning: policyResult.violationReason,
              overriddenBy: overrideReason ? new mongoose.Types.ObjectId(auth.user.id) : undefined,
              overrideReason: overrideReason || undefined,
            },
          },
          registeredBy: new mongoose.Types.ObjectId(auth.user.id),
          isLateRegistration: isLate,
          lateRegistrationReason: isLate ? lateRegistrationReason : undefined,
        });

        await logAudit({
          userId: auth.user.id,
          userEmail: auth.user.email || undefined,
          userRole: auth.user.role,
          action: 'REGISTER_APPLICANT',
          resource: 'Application',
          resourceId: app._id.toString(),
          details: {
            driveId: drive._id.toString(),
            studentId: student._id.toString(),
            studentRoll: student.rollNumber,
            isLate,
            isOverride: Boolean(overrideReason),
          },
        });

        results.push({
          studentId: student._id.toString(),
          studentName: student.name,
          status: 'created',
        });
        createdApplications.push(app);
      } catch (err: unknown) {
        // Handle unique compound index race condition
        if ((err as { code?: number }).code === 11000) {
          results.push({
            studentId: student._id.toString(),
            studentName: student.name,
            status: 'skipped',
            reason: 'Already registered for this drive (concurrent request)',
          });
        } else {
          throw err;
        }
      }
    }

    if (targetStudentIds.length === 1 && createdApplications.length === 1) {
      return NextResponse.json(createdApplications[0], { status: 201 });
    }

    return NextResponse.json(
      {
        summary: {
          total: targetStudentIds.length,
          created: createdApplications.length,
          skipped: results.filter((r) => r.status === 'skipped').length,
          errors: results.filter((r) => r.status === 'error').length,
        },
        results,
      },
      { status: createdApplications.length > 0 ? 201 : 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/drives/[id]/applications error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
