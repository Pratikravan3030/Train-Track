import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Student from '@/models/Student';
import Application from '@/models/Application';
import { requirePermission } from '@/lib/auth-guards';
import { evaluateStudentEligibility } from '@/lib/eligibilityEngine';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const url = new URL(request.url);

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const search = url.searchParams.get('search') || '';
    const filterStatus = url.searchParams.get('status') || 'all'; // 'eligible' | 'ineligible' | 'all'
    const batchParam = url.searchParams.get('batch');

    await dbConnect();

    const drive = await Drive.findById(id).lean();
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    // Determine target batch
    const targetBatch = batchParam
      ? parseInt(batchParam, 10)
      : drive.eligibilityRules?.allowedBatches?.[0] || DEFAULT_PASSOUT_YEAR;

    // Student query filter
    const studentFilter: Record<string, unknown> = {
      passoutYear: targetBatch,
    };

    // Role-based department scoping
    if (auth.user.role === 'DEPT_COORDINATOR') {
      studentFilter.department = auth.user.department;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      studentFilter.$or = [
        { name: searchRegex },
        { rollNumber: searchRegex },
        { prn: searchRegex },
      ];
    }

    // Fetch matching students
    const students = await Student.find(studentFilter)
      .select('name rollNumber prn department passoutYear cgpa backlogs tenthPercentage twelfthOrDiplomaPercentage placementStatus')
      .sort({ rollNumber: 1 })
      .lean();

    // Fetch existing registrations for this drive
    const applications = await Application.find({ drive: id })
      .select('student status')
      .lean();

    const appMap = new Map<string, string>();
    for (const app of applications) {
      appMap.set(String(app.student), app.status);
    }

    // Evaluate eligibility for each student
    let eligibleCount = 0;
    let ineligibleCount = 0;
    let incompleteDataCount = 0;
    let registeredCount = 0;

    const evaluatedStudents = students.map((s) => {
      const evalResult = evaluateStudentEligibility(s, drive.eligibilityRules);
      const appStatus = appMap.get(String(s._id));
      const isRegistered = Boolean(appStatus);

      if (evalResult.isEligible) {
        eligibleCount++;
      } else {
        ineligibleCount++;
      }

      if (evalResult.isDataIncomplete) {
        incompleteDataCount++;
      }

      if (isRegistered) {
        registeredCount++;
      }

      return {
        _id: s._id,
        name: s.name,
        rollNumber: s.rollNumber,
        prn: s.prn,
        department: s.department,
        passoutYear: s.passoutYear,
        cgpa: s.cgpa,
        backlogs: s.backlogs,
        tenthPercentage: s.tenthPercentage,
        twelfthOrDiplomaPercentage: s.twelfthOrDiplomaPercentage,
        placementStatus: s.placementStatus,
        isEligible: evalResult.isEligible,
        reasons: evalResult.reasons,
        isDataIncomplete: evalResult.isDataIncomplete,
        missingFields: evalResult.missingFields,
        criteriaChecks: evalResult.criteriaChecks,
        isRegistered,
        applicationStatus: appStatus || null,
      };
    });

    // Filter by eligible/ineligible if requested
    let filteredList = evaluatedStudents;
    if (filterStatus === 'eligible') {
      filteredList = evaluatedStudents.filter((s) => s.isEligible);
    } else if (filterStatus === 'ineligible') {
      filteredList = evaluatedStudents.filter((s) => !s.isEligible);
    }

    const total = filteredList.length;
    const skip = (page - 1) * limit;
    const paginatedList = filteredList.slice(skip, skip + limit);

    return NextResponse.json({
      data: paginatedList,
      stats: {
        totalEvaluated: students.length,
        eligibleCount,
        ineligibleCount,
        incompleteDataCount,
        registeredCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      rules: drive.eligibilityRules,
      targetBatch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/drives/[id]/eligible error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
