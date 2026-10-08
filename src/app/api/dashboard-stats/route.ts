import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission } from '@/lib/auth-guards';

export async function GET() {
  const auth = await requirePermission('dashboard', 'read');
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();

    const isDeptCoordinator = auth.scope === 'own-department' && auth.user.department;
    const coordinatorDept = isDeptCoordinator ? auth.user.department : null;

    // Student scope filter
    const studentFilter = coordinatorDept
      ? { $or: [{ department: coordinatorDept }, { branch: coordinatorDept }] }
      : {};

    // 1. Total Student Metrics
    const totalStudents = await Student.countDocuments(studentFilter);

    // 2. Department-wise distribution (real aggregation)
    const deptAgg = await Student.aggregate([
      ...(coordinatorDept ? [{ $match: { $or: [{ department: coordinatorDept }, { branch: coordinatorDept }] } }] : []),
      { $group: { _id: { $ifNull: ['$department', '$branch'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const departmentDistribution = deptAgg.map((d) => ({
      department: d._id || 'Unassigned',
      students: d.count,
    }));

    // 3. Year-wise distribution (real aggregation)
    const yearAgg = await Student.aggregate([
      ...(coordinatorDept ? [{ $match: { $or: [{ department: coordinatorDept }, { branch: coordinatorDept }] } }] : []),
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const yearDistribution = yearAgg.map((y) => ({
      year: y._id || 'Unassigned',
      students: y.count,
    }));

    // 4. Training Sessions
    const totalSessions = await TrainingSession.countDocuments();

    // 5. Scoped Attendance Statistics
    let deptStudentIds: unknown[] = [];
    if (coordinatorDept) {
      deptStudentIds = await Student.find({
        $or: [{ department: coordinatorDept }, { branch: coordinatorDept }],
      }).distinct('_id');
    }

    const attendanceFilter = coordinatorDept ? { studentId: { $in: deptStudentIds } } : {};
    const totalAttendanceRecords = await Attendance.countDocuments(attendanceFilter);
    const presentAttendanceRecords = await Attendance.countDocuments({
      ...attendanceFilter,
      present: true,
    });
    const overallAttendanceRate =
      totalAttendanceRecords > 0
        ? parseFloat(((presentAttendanceRecords / totalAttendanceRecords) * 100).toFixed(1))
        : 0;

    // 6. Scoped Overall Average Feedback Rating (excludes staff notes from averages)
    const feedbackMatchConditions: Record<string, unknown> = {
      source: { $ne: 'staff' },
    };
    if (coordinatorDept) {
      feedbackMatchConditions.studentId = { $in: deptStudentIds };
    }
    const feedbackMatch = [{ $match: feedbackMatchConditions }];

    const overallAvgObj = await Feedback.aggregate([
      ...feedbackMatch,
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalFeedbacks: { $sum: 1 },
        },
      },
    ]);
    const averageRating = overallAvgObj.length > 0 ? parseFloat(overallAvgObj[0].averageRating.toFixed(2)) : 0;
    const totalFeedbacks = overallAvgObj.length > 0 ? overallAvgObj[0].totalFeedbacks : 0;

    // 7. Session Average Ratings (chronological for Recharts, scoped by dept)
    const sessions = await TrainingSession.find({}).sort({ date: 1 });
    const feedbackStats = await Feedback.aggregate([
      ...feedbackMatch,
      {
        $group: {
          _id: '$sessionId',
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    const ratingsMap = new Map(feedbackStats.map((f) => [f._id.toString(), f.averageRating]));

    const sessionRatings = sessions.map((session) => ({
      id: session._id.toString(),
      title: session.title,
      date: session.date,
      averageRating: parseFloat((ratingsMap.get(session._id.toString()) || 0).toFixed(2)),
    }));

    // 8. Upcoming Sessions (from start of today onwards)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingSessions = await TrainingSession.find({
      date: { $gte: today },
    })
      .sort({ date: 1 })
      .limit(5);

    return NextResponse.json(
      {
        totalStudents,
        totalSessions,
        totalAttendanceRecords,
        overallAttendanceRate,
        totalFeedbacks,
        averageRating,
        departmentDistribution,
        yearDistribution,
        sessionRatings,
        upcomingSessions,
        userRole: auth.user.role,
        department: auth.user.department,
        scope: auth.scope,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/dashboard-stats error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
