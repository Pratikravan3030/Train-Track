import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { resolveStudentDepartment } from '@/lib/departmentMapper';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';
import { importStudentRowSchema, ImportStudentRow } from '@/lib/validations/student-import';

export async function POST(request: Request) {
  const auth = await requirePermission('students', 'import');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const rawStudents = body.students as ImportStudentRow[] | undefined;
    const batch = Number(body.batch) || DEFAULT_PASSOUT_YEAR;

    if (!rawStudents || !Array.isArray(rawStudents) || rawStudents.length === 0) {
      return NextResponse.json(
        { error: 'No student records provided for import.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const studentsToInsert: Record<string, unknown>[] = [];
    const rollNumbersInBatch = new Set<string>();
    const duplicateErrors: string[] = [];

    // Pre-fetch all existing roll numbers in one query for fast conflict detection
    const incomingRolls = rawStudents
      .map((s) => s.rollNumber?.trim().toUpperCase())
      .filter(Boolean);
    const existingInDb = await Student.find({
      rollNumber: { $in: incomingRolls },
    }).select('rollNumber name department');
    const existingMap = new Map(existingInDb.map((e) => [e.rollNumber, e]));

    for (let i = 0; i < rawStudents.length; i++) {
      const student = rawStudents[i];
      const rowNum = i + 1;

      // Validate schema
      const parseResult = importStudentRowSchema.safeParse(student);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: `Validation failure on record ${rowNum}: ${parseResult.error.issues[0]?.message}`,
            details: parseResult.error.format(),
          },
          { status: 400 }
        );
      }

      const validData = parseResult.data;
      const rollNumber = validData.rollNumber.trim().toUpperCase();

      // Check duplicates in payload
      if (rollNumbersInBatch.has(rollNumber)) {
        duplicateErrors.push(`PRN "${rollNumber}" is duplicated within the import batch.`);
      }
      rollNumbersInBatch.add(rollNumber);

      // Check duplicates in database (NEVER silently merge)
      if (existingMap.has(rollNumber)) {
        const existing = existingMap.get(rollNumber)!;
        duplicateErrors.push(
          `PRN "${rollNumber}" already exists in the database (${existing.name}, ${existing.department}).`
        );
      }

      // Department Single Source of Truth
      let canonicalDept: string;
      try {
        canonicalDept = resolveStudentDepartment({ department: validData.department });
      } catch (deptErr) {
        return NextResponse.json(
          { error: `Record ${rowNum}: ${deptErr instanceof Error ? deptErr.message : 'Invalid department'}` },
          { status: 400 }
        );
      }

      // Coordinator scope enforcement
      if (
        auth.user.role === 'DEPT_COORDINATOR' &&
        auth.user.department &&
        canonicalDept !== auth.user.department
      ) {
        return NextResponse.json(
          {
            error: `Forbidden. As ${auth.user.department} coordinator, you cannot import students into department "${canonicalDept}".`,
          },
          { status: 403 }
        );
      }

      // Placement status governance: Coordinators cannot set initial placed status during import
      const placementStatus =
        auth.user.role === 'DEPT_COORDINATOR' ? 'Not Placed' : validData.placementStatus || 'Not Placed';

      studentsToInsert.push({
        name: validData.name.trim(),
        rollNumber,
        department: canonicalDept,
        year: validData.year,
        passoutYear: validData.passoutYear || batch,
        placementStatus,
        cgpa: validData.cgpa ?? null,
        backlogs: validData.backlogs ?? null,
        tenthPercentage: validData.tenthPercentage ?? null,
        twelfthOrDiplomaPercentage: validData.twelfthOrDiplomaPercentage ?? null,
        email: validData.email ? validData.email.trim().toLowerCase() : undefined,
        phone: validData.phone ? validData.phone.trim() : undefined,
      });
    }

    if (duplicateErrors.length > 0) {
      return NextResponse.json(
        {
          error: `Import aborted. Found ${duplicateErrors.length} duplicate PRN/Roll Number conflicts.`,
          duplicateConflicts: duplicateErrors,
        },
        { status: 409 }
      );
    }

    const inserted = await Student.insertMany(studentsToInsert, { ordered: true });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'IMPORT_STUDENTS',
      resource: 'Student',
      details: {
        count: inserted.length,
        batch,
        department: auth.user.department || 'ALL',
      },
    });

    return NextResponse.json(
      {
        message: `Successfully imported ${inserted.length} students for Batch ${batch}.`,
        count: inserted.length,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/students/import error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
