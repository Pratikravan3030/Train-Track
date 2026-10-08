import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { studentQuerySchema, createStudentSchema } from '@/lib/validations/student';
import { resolveStudentDepartment } from '@/lib/departmentMapper';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';

export async function GET(request: Request) {
  const auth = await requirePermission('students', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = studentQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      search,
      department,
      branch,
      year,
      passoutYear,
      batch,
      placementStatus,
      minCgpa,
      maxBacklogs,
      sortBy = 'name',
      sortOrder = 'asc',
      all,
    } = parsedQuery.data;

    await dbConnect();

    const andConditions: Record<string, unknown>[] = [];

    // Batch / Passout Year Isolation: Defaults to current graduating batch so cohorts never mix
    const requestedBatch = passoutYear ?? batch;
    const effectiveBatch = requestedBatch !== undefined ? requestedBatch : DEFAULT_PASSOUT_YEAR;
    if (effectiveBatch && effectiveBatch > 0) {
      andConditions.push({ passoutYear: effectiveBatch });
    }

    // Department Coordinator can only view students from their own department
    const deptFilter = department || branch;
    if (auth.user.role === 'DEPT_COORDINATOR' && auth.user.department) {
      andConditions.push({
        $or: [{ department: auth.user.department }, { branch: auth.user.department }],
      });
    } else if (deptFilter && deptFilter !== 'all') {
      andConditions.push({
        $or: [{ department: deptFilter }, { branch: deptFilter }],
      });
    }

    if (year && year !== 'all') {
      andConditions.push({ year });
    }

    if (placementStatus && placementStatus !== 'all') {
      andConditions.push({ placementStatus });
    }

    if (minCgpa !== undefined && minCgpa > 0) {
      andConditions.push({ cgpa: { $gte: minCgpa } });
    }

    if (maxBacklogs !== undefined) {
      andConditions.push({ backlogs: { $lte: maxBacklogs } });
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      andConditions.push({
        $or: [
          { name: searchRegex },
          { rollNumber: searchRegex },
          { email: searchRegex },
          { branch: searchRegex },
          { department: searchRegex },
        ],
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    // Support unpaginated fetch when specifically requested (e.g. for complete attendance lists or exports)
    if (all === 'true') {
      const allStudents = await Student.find(filter).sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
      return NextResponse.json(
        {
          data: allStudents,
          pagination: {
            page: 1,
            limit: allStudents.length,
            total: allStudents.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        { status: 200 }
      );
    }

    const total = await Student.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const baseScope = auth.user.role === 'DEPT_COORDINATOR' && auth.user.department
      ? { $or: [{ department: auth.user.department }, { branch: auth.user.department }] }
      : {};

    const [students, deptFacet, yearFacet, totalAll] = await Promise.all([
      Student.find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Student.aggregate([
        { $match: baseScope },
        { $group: { _id: '$branch', count: { $sum: 1 } } },
      ]),
      Student.aggregate([
        { $match: baseScope },
        { $group: { _id: '$year', count: { $sum: 1 } } },
      ]),
      Student.countDocuments(baseScope),
    ]);

    const departmentCounts: Record<string, number> = {};
    deptFacet.forEach((d) => {
      if (d._id) departmentCounts[d._id] = d.count;
    });

    const yearCounts: Record<string, number> = {};
    yearFacet.forEach((y) => {
      if (y._id) yearCounts[y._id] = y.count;
    });

    return NextResponse.json(
      {
        data: students,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        facets: {
          departmentCounts,
          yearCounts,
          totalAll,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/students error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('students', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parseResult = createStudentSchema.safeParse(json);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const {
      name,
      rollNumber,
      department: rawDept,
      branch: rawBranch,
      year,
      passoutYear,
      placementStatus,
      placementDetails,
      cgpa,
      backlogs,
      resumeUrl,
      email,
      phone,
    } = parseResult.data;

    let validatedDepartment: string;
    try {
      validatedDepartment = resolveStudentDepartment({ department: rawDept, branch: rawBranch });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid department' },
        { status: 400 }
      );
    }

    // Dept coordinators can only add students to their own department
    if (auth.user.role === 'DEPT_COORDINATOR' && auth.user.department) {
      if (!canAccessDepartment(auth.user, validatedDepartment)) {
        return NextResponse.json(
          {
            error: `Department coordinators can only enroll students into their assigned department: ${auth.user.department}`,
          },
          { status: 403 }
        );
      }
    }

    await dbConnect();

    // Check unique rollNumber / PRN
    const existingStudent = await Student.findOne({ rollNumber });
    if (existingStudent) {
      return NextResponse.json(
        { error: `Student with Roll Number / PRN "${rollNumber}" is already registered.` },
        { status: 409 }
      );
    }

    // Department is the single source of truth; stop writing to legacy branch field
    const newStudent = await Student.create({
      name,
      rollNumber,
      department: validatedDepartment,
      year,
      passoutYear,
      placementStatus: placementStatus || 'Not Placed',
      placementDetails,
      cgpa,
      backlogs: backlogs ?? 0,
      resumeUrl,
      email,
      phone,
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_STUDENT',
      resource: 'Student',
      resourceId: newStudent._id.toString(),
      details: { rollNumber, department: validatedDepartment, year },
    });

    return NextResponse.json(newStudent, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/students error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
