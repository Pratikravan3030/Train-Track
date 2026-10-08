import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission } from '@/lib/auth-guards';

import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';

export async function GET(request: Request) {
  const auth = await requirePermission('dashboard', 'read');
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const batchParam = searchParams.get('batch') || searchParams.get('passoutYear');
    const effectiveBatch =
      batchParam && batchParam !== 'all'
        ? parseInt(batchParam, 10)
        : batchParam === 'all'
        ? null
        : DEFAULT_PASSOUT_YEAR;

    const isDeptCoordinator = auth.scope === 'own-department' && auth.user.department;
    const coordinatorDept = isDeptCoordinator ? auth.user.department : null;

    // Student scope & batch filter
    const studentFilter: Record<string, unknown> = {};
    if (coordinatorDept) {
      studentFilter.$or = [{ department: coordinatorDept }, { branch: coordinatorDept }];
    }
    if (effectiveBatch) {
      studentFilter.passoutYear = effectiveBatch;
    }

    // 1. Total Student Metrics
    const totalStudents = await Student.countDocuments(studentFilter);

    // 2. Department-wise distribution (real aggregation)
    const deptAgg = await Student.aggregate([
      { $match: studentFilter },
      { $group: { _id: { $ifNull: ['$department', '$branch'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const departmentDistribution = deptAgg.map((d) => ({
      department: d._id || 'Unassigned',
      students: d.count,
    }));

    // 3. Year-wise distribution (real aggregation)
    const yearAgg = await Student.aggregate([
      { $match: studentFilter },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const yearDistribution = yearAgg.map((y) => ({
      year: y._id || 'Unassigned',
      students: y.count,
    }));

    // 4. Placement Statistics
    const placedCount = await Student.countDocuments({
      ...studentFilter,
      placementStatus: 'Placed',
    });
    const placementRate =
      totalStudents > 0 ? parseFloat(((placedCount / totalStudents) * 100).toFixed(1)) : 0;

    const placementAgg = await Student.aggregate([
      { $match: studentFilter },
      { $group: { _id: { $ifNull: ['$placementStatus', 'Not Placed'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const placementDistribution = placementAgg.map((p) => ({
      status: p._id as string,
      count: p.count as number,
    }));

    const packageAgg = await Student.aggregate([
      {
        $match: {
          ...studentFilter,
          placementStatus: 'Placed',
          'placementDetails.packageLPA': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          avgPackage: { $avg: '$placementDetails.packageLPA' },
          highestPackage: { $max: '$placementDetails.packageLPA' },
        },
      },
    ]);
    const avgPackageLPA =
      packageAgg.length > 0 ? parseFloat(packageAgg[0].avgPackage.toFixed(2)) : 0;
    const highestPackageLPA =
      packageAgg.length > 0 ? parseFloat(packageAgg[0].highestPackage.toFixed(2)) : 0;

    // 5. Training Sessions
    const totalSessions = await TrainingSession.countDocuments();

    // 6. Scoped Attendance Statistics
    let deptStudentIds: unknown[] = [];
    if (coordinatorDept) {
      deptStudentIds = await Student.find(studentFilter).distinct('_id');
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

    // 7. Scoped Overall Average Feedback Rating (excludes staff notes from averages)
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

    // 8. Session Average Ratings (chronological for Recharts, scoped by dept)
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

    // 9. Upcoming Sessions (from start of today onwards)
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
        placedStudents: placedCount,
        placementRate,
        placementDistribution,
        avgPackageLPA,
        highestPackageLPA,
        selectedBatch: effectiveBatch || 'all',
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
