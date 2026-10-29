import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { attendanceQuerySchema, saveAttendanceSchema } from '@/lib/validations/attendance';

export async function GET(request: Request) {
  const auth = await requirePermission('attendance', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = attendanceQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Session ID is required.', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { sessionId } = parsedQuery.data;
    await dbConnect();

    // Department Coordinator is strictly scoped to students in their own department
    if (auth.scope === 'own-department') {
      const coordinatorDept = auth.user.department;
      if (!coordinatorDept) {
        return NextResponse.json(
          { error: 'Coordinator profile is missing an assigned department.' },
          { status: 403 }
        );
      }

      const deptStudentIds = await Student.find({
        $or: [{ department: coordinatorDept }, { branch: coordinatorDept }],
      }).distinct('_id');
      const attendance = await Attendance.find({
        sessionId,
        studentId: { $in: deptStudentIds },
      }).populate('studentId', 'name rollNumber branch department');

      return NextResponse.json(attendance, { status: 200 });
    }

    // Universal staff roles (SUPER_ADMIN, TPO)
    const attendance = await Attendance.find({ sessionId }).populate('studentId', 'name rollNumber branch department');
    return NextResponse.json(attendance, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/attendance error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('attendance', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parseResult = saveAttendanceSchema.safeParse(json);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { sessionId, records } = parseResult.data;
    await dbConnect();

    // Department Coordinator validation: EVERY studentId in the payload must belong to their department
    if (auth.scope === 'own-department') {
      const coordinatorDept = auth.user.department;
      if (!coordinatorDept) {
        return NextResponse.json(
          { error: 'Coordinator profile is missing an assigned department.' },
          { status: 403 }
        );
      }

      const payloadStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
      const validDeptStudents = await Student.find({
        _id: { $in: payloadStudentIds },
        $or: [{ department: coordinatorDept }, { branch: coordinatorDept }],
      }).select('_id');

      if (validDeptStudents.length !== payloadStudentIds.length) {
        return NextResponse.json(
          {
            error: `Cross-department attendance manipulation rejected. One or more students in the payload do not belong to your assigned department: ${coordinatorDept}.`,
          },
          { status: 403 }
        );
      }
    }

    // Prepare bulk operations for upserting attendance records
    const bulkOps = records.map((record) => {
      const status = record.status || (record.present ? 'Present' : 'Absent');
      const present = status === 'Present' || status === 'Late';
      return {
        updateOne: {
          filter: { sessionId, studentId: record.studentId },
          update: {
            $set: {
              present,
              status,
              remarks: record.remarks,
              markedBy: auth.user.id,
              markedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_ATTENDANCE',
      resource: 'Attendance',
      resourceId: sessionId,
      details: { recordCount: records.length, scope: auth.scope },
    });

    return NextResponse.json({ message: 'Attendance updated successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/attendance error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
