import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import Student from '@/models/Student';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';
import { serializeCsv } from '@/lib/csv';
import { generateExcelBuffer } from '@/lib/excel';

export async function GET(request: Request) {
  const auth = await requirePermission('reports', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchParam = searchParams.get('batch') || searchParams.get('passoutYear');
    const effectiveBatch =
      batchParam && batchParam !== 'all'
        ? parseInt(batchParam, 10)
        : batchParam === 'all'
        ? null
        : DEFAULT_PASSOUT_YEAR;

    const requestedDept = searchParams.get('department');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    // Scoping check for coordinator
    if (auth.user.role === 'DEPT_COORDINATOR' && requestedDept) {
      if (!canAccessDepartment(auth.user, requestedDept)) {
        return NextResponse.json(
          { error: 'Forbidden. You cannot view training reports outside your department.' },
          { status: 403 }
        );
      }
    }

    const effectiveDept =
      auth.user.role === 'DEPT_COORDINATOR' ? auth.user.department : requestedDept;

    await dbConnect();

    // 1. Build Student Filter
    const studentFilter: Record<string, unknown> = {
      isDeleted: { $ne: true },
    };
    if (effectiveBatch) {
      studentFilter.passoutYear = effectiveBatch;
    }
    if (effectiveDept && effectiveDept !== 'all') {
      studentFilter.$or = [{ department: effectiveDept }, { branch: effectiveDept }];
    }

    const students = await Student.find(studentFilter).lean();
    const studentIdMap = new Map<string, typeof students[0]>();
    const studentIds = students.map((s) => {
      studentIdMap.set(s._id.toString(), s);
      return s._id;
    });

    // 2. Build Session Filter
    const sessionFilter: Record<string, unknown> = {
      isDeleted: { $ne: true },
    };
    if (startDateParam || endDateParam) {
      const dateQuery: Record<string, Date> = {};
      if (startDateParam) dateQuery.$gte = new Date(startDateParam);
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      sessionFilter.date = dateQuery;
    }

    const sessions = await TrainingSession.find(sessionFilter).sort({ date: -1 }).lean();
    const sessionIds = sessions.map((s) => s._id);

    // 3. Attendance Records
    const attendanceFilter: Record<string, unknown> = {
      sessionId: { $in: sessionIds },
      studentId: { $in: studentIds },
    };
    const attendanceRecords = await Attendance.find(attendanceFilter).lean();

    // 4. Feedback Records
    const feedbackRecords = await Feedback.find({
      sessionId: { $in: sessionIds },
      studentId: { $in: studentIds },
    }).lean();

    const totalSessions = sessions.length;
    const totalAttendances = attendanceRecords.length;
    const presentAttendances = attendanceRecords.filter((a) => a.present).length;
    const overallAttendanceRate =
      totalAttendances > 0
        ? parseFloat(((presentAttendances / totalAttendances) * 100).toFixed(1))
        : 0;

    const totalFeedbacks = feedbackRecords.length;
    const averageFeedbackRating =
      totalFeedbacks > 0
        ? parseFloat(
            (feedbackRecords.reduce((acc, f) => acc + (f.rating || 0), 0) / totalFeedbacks).toFixed(2)
          )
        : 0;

    // 5. Per-Session Breakdown
    const sessionAttendanceMap = new Map<string, { total: number; present: number }>();
    attendanceRecords.forEach((a) => {
      const sId = a.sessionId.toString();
      if (!sessionAttendanceMap.has(sId)) {
        sessionAttendanceMap.set(sId, { total: 0, present: 0 });
      }
      const item = sessionAttendanceMap.get(sId)!;
      item.total++;
      if (a.present) item.present++;
    });

    const sessionFeedbackMap = new Map<string, number[]>();
    feedbackRecords.forEach((f) => {
      const sId = f.sessionId.toString();
      if (!sessionFeedbackMap.has(sId)) {
        sessionFeedbackMap.set(sId, []);
      }
      if (f.rating) sessionFeedbackMap.get(sId)!.push(f.rating);
    });

    const sessionBreakdown = sessions.map((s) => {
      const sId = s._id.toString();
      const att = sessionAttendanceMap.get(sId) || { total: 0, present: 0 };
      const ratings = sessionFeedbackMap.get(sId) || [];
      const avgRating =
        ratings.length > 0
          ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
          : 0;
      const attRate =
        att.total > 0 ? parseFloat(((att.present / att.total) * 100).toFixed(1)) : 0;

      return {
        sessionId: sId,
        title: s.title,
        date: new Date(s.date).toISOString().split('T')[0],
        trainer: s.trainer || 'Guest Trainer',
        totalEligible: att.total,
        presentCount: att.present,
        attendanceRate: attRate,
        feedbackCount: ratings.length,
        averageRating: avgRating,
      };
    });

    // 6. Student Attendance & Defaulter List (< 75% attendance)
    const studentPresentCountMap = new Map<string, number>();
    const studentTotalCountMap = new Map<string, number>();

    attendanceRecords.forEach((a) => {
      const stId = a.studentId.toString();
      studentTotalCountMap.set(stId, (studentTotalCountMap.get(stId) || 0) + 1);
      if (a.present) {
        studentPresentCountMap.set(stId, (studentPresentCountMap.get(stId) || 0) + 1);
      }
    });

    const studentAttendanceSummary = students.map((s) => {
      const stId = s._id.toString();
      const total = studentTotalCountMap.get(stId) || 0;
      const present = studentPresentCountMap.get(stId) || 0;
      const rate = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0;
      return {
        rollNumber: s.rollNumber,
        name: s.name,
        department: s.department || 'Unassigned',
        passoutYear: s.passoutYear || effectiveBatch || 'N/A',
        totalSessions: total,
        attendedSessions: present,
        attendanceRate: rate,
        isDefaulter: total > 0 && rate < 75,
      };
    });

    const defaultersList = studentAttendanceSummary.filter((s) => s.isDefaulter);
    const defaultersCount = defaultersList.length;
    const defaulterRate =
      students.length > 0
        ? parseFloat(((defaultersCount / students.length) * 100).toFixed(1))
        : 0;

    const summary = {
      totalSessions,
      totalStudentsEnrolled: students.length,
      totalAttendanceRecords: totalAttendances,
      presentAttendanceRecords: presentAttendances,
      overallAttendanceRate,
      defaultersCount,
      defaulterRate,
      defaulterThresholdPercent: 75,
      totalFeedbacks,
      averageFeedbackRating,
    };

    // CSV Export
    if (format === 'csv') {
      const headers = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'department', label: 'Department' },
        { key: 'passoutYear', label: 'Batch' },
        { key: 'totalSessions', label: 'Total Sessions Scheduled' },
        { key: 'attendedSessions', label: 'Sessions Attended' },
        { key: 'attendanceRate', label: 'Attendance %' },
        { key: 'isDefaulter', label: 'Defaulter (<75%)' },
      ];

      const csvContent = serializeCsv(headers, studentAttendanceSummary);
      const filename = `training-attendance-report-${effectiveDept || 'campus'}-${effectiveBatch || 'all'}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Excel Export
    if (format === 'excel') {
      const columns = [
        { header: 'Roll Number', key: 'rollNumber', width: 16 },
        { header: 'Student Name', key: 'name', width: 24 },
        { header: 'Department', key: 'department', width: 14 },
        { header: 'Batch', key: 'passoutYear', width: 12 },
        { header: 'Total Sessions', key: 'totalSessions', width: 16 },
        { header: 'Attended Sessions', key: 'attendedSessions', width: 18 },
        { header: 'Attendance %', key: 'attendanceRate', width: 16 },
        { header: 'Defaulter (<75%)', key: 'isDefaulter', width: 16 },
      ];

      const summaryCards = [
        { label: 'Total Sessions Conducted', value: totalSessions },
        { label: 'Enrolled Students', value: students.length },
        { label: 'Overall Attendance Rate (%)', value: `${overallAttendanceRate}%` },
        { label: 'Defaulters Count (<75%)', value: defaultersCount },
        { label: 'Defaulter Rate (%)', value: `${defaulterRate}%` },
        { label: 'Total Student Feedbacks', value: totalFeedbacks },
        { label: 'Average Feedback Rating (1-5)', value: `${averageFeedbackRating} / 5.0` },
      ];

      const excelBuffer = await generateExcelBuffer({
        title: `CampusPlace Training & Attendance Report — Batch ${effectiveBatch || 'All'} (${effectiveDept || 'All Departments'})`,
        sheetName: 'Training Attendance',
        columns,
        data: studentAttendanceSummary,
        summaryCards,
      });

      const filename = `training-attendance-report-${effectiveDept || 'campus'}-${effectiveBatch || 'all'}.xlsx`;

      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default JSON
    return NextResponse.json({
      summary,
      sessionBreakdown,
      defaultersList,
      studentAttendanceSummary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/reports/training error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
