import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';
import { serializeCsv } from '@/lib/csv';

export async function GET(request: Request) {
  const auth = await requirePermission('attendance', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchParam = searchParams.get('batch');
    const effectiveBatch =
      batchParam && batchParam !== 'all'
        ? parseInt(batchParam, 10)
        : batchParam === 'all'
        ? null
        : DEFAULT_PASSOUT_YEAR;

    const requestedDept = searchParams.get('department');
    const threshold = Math.max(1, Math.min(100, parseInt(searchParams.get('threshold') || '75', 10)));
    const format = searchParams.get('format') || 'json';

    // Scoping for coordinator
    if (auth.user.role === 'DEPT_COORDINATOR' && requestedDept) {
      if (!canAccessDepartment(auth.user, requestedDept)) {
        return NextResponse.json(
          { error: 'Forbidden. You cannot view attendance defaulters outside your department.' },
          { status: 403 }
        );
      }
    }

    const effectiveDept =
      auth.user.role === 'DEPT_COORDINATOR' ? auth.user.department : requestedDept;

    await dbConnect();

    // 1. Fetch Students
    const studentFilter: Record<string, unknown> = {
      isDeleted: { $ne: true },
    };
    if (effectiveBatch) {
      studentFilter.passoutYear = effectiveBatch;
    }
    if (effectiveDept && effectiveDept !== 'all') {
      studentFilter.$or = [{ department: effectiveDept }, { branch: effectiveDept }];
    }

    const students = await Student.find(studentFilter)
      .select('_id name rollNumber department passoutYear year')
      .lean();
    const studentIds = students.map((s) => s._id);

    // 2. Fetch Sessions
    const sessions = await TrainingSession.find({ isDeleted: { $ne: true } })
      .select('_id')
      .lean();
    const sessionIds = sessions.map((s) => s._id);

    // 3. Fetch Attendance
    const attendances = await Attendance.find({
      sessionId: { $in: sessionIds },
      studentId: { $in: studentIds },
    }).lean();

    const studentTotalMap = new Map<string, number>();
    const studentPresentMap = new Map<string, number>();

    attendances.forEach((a) => {
      const stId = a.studentId.toString();
      studentTotalMap.set(stId, (studentTotalMap.get(stId) || 0) + 1);
      if (a.present) {
        studentPresentMap.set(stId, (studentPresentMap.get(stId) || 0) + 1);
      }
    });

    const evaluatedStudents = students.map((s) => {
      const stId = s._id.toString();
      const total = studentTotalMap.get(stId) || 0;
      const present = studentPresentMap.get(stId) || 0;
      const rate = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0;
      return {
        _id: stId,
        rollNumber: s.rollNumber,
        name: s.name,
        department: s.department,
        passoutYear: s.passoutYear,
        totalSessions: total,
        attendedSessions: present,
        attendanceRate: rate,
        isDefaulter: total > 0 && rate < threshold,
      };
    });

    const defaulters = evaluatedStudents.filter((s) => s.isDefaulter);

    if (format === 'csv') {
      const headers = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'department', label: 'Department' },
        { key: 'passoutYear', label: 'Batch' },
        { key: 'totalSessions', label: 'Total Scheduled Sessions' },
        { key: 'attendedSessions', label: 'Sessions Attended' },
        { key: 'attendanceRate', label: 'Attendance %' },
      ];

      const csvData = serializeCsv(headers, defaulters);
      const filename = `attendance-defaulters-${effectiveDept || 'campus'}-${effectiveBatch || 'all'}.csv`;

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      defaulters,
      totalStudents: students.length,
      defaulterCount: defaulters.length,
      defaulterRate:
        students.length > 0
          ? parseFloat(((defaulters.length / students.length) * 100).toFixed(1))
          : 0,
      threshold,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/sessions/defaulters error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
