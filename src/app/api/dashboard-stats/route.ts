import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Offer from '@/models/Offer';
import Drive from '@/models/Drive';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission } from '@/lib/auth-guards';
import {
  DEFAULT_PASSOUT_YEAR,
  PLACEMENT_POLICY_CONFIG,
  resolveOfferTier,
} from '@/config/collegeConfig';

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
      studentFilter.department = coordinatorDept;
    }
    if (effectiveBatch) {
      studentFilter.passoutYear = effectiveBatch;
    }

    // 1. Total Student Metrics
    const totalStudents = await Student.countDocuments(studentFilter);

    // 2. Department-wise distribution
    const deptAgg = await Student.aggregate([
      { $match: studentFilter },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const departmentDistribution = deptAgg.map((d) => ({
      department: d._id || 'Unassigned',
      students: d.count,
    }));

    // 3. Year-wise distribution
    const yearAgg = await Student.aggregate([
      { $match: studentFilter },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const yearDistribution = yearAgg.map((y) => ({
      year: y._id || 'Unassigned',
      students: y.count,
    }));

    // 4. Placed & Opted In Counts
    const placedCount = await Student.countDocuments({
      ...studentFilter,
      placementStatus: 'Placed',
    });

    const excludedFromPlacementCount = await Student.countDocuments({
      ...studentFilter,
      placementStatus: { $in: ['Opted Out', 'Higher Studies'] },
    });

    const eligibleOptedInStudents = Math.max(0, totalStudents - excludedFromPlacementCount);

    // Dynamic placement rate per transparent institutional formula
    const placementRate =
      eligibleOptedInStudents > 0
        ? parseFloat(((placedCount / eligibleOptedInStudents) * 100).toFixed(1))
        : 0;

    const placementAgg = await Student.aggregate([
      { $match: studentFilter },
      { $group: { _id: { $ifNull: ['$placementStatus', 'Not Placed'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const placementDistribution = placementAgg.map((p) => ({
      status: p._id as string,
      count: p.count as number,
    }));

    // 5. Server-side Package Statistics using ONLY Accepted Qualifying Offers
    // Qualifying offer types: ['Full-time', 'PPO'] per PLACEMENT_POLICY_CONFIG
    const qualifyingTypes = [...PLACEMENT_POLICY_CONFIG.rules.placementStatOfferTypes];
    const targetStudentIds = await Student.find(studentFilter).distinct('_id');

    // Aggregate highest accepted qualifying offer per distinct placed student
    const studentOffersAgg = await Offer.aggregate([
      {
        $match: {
          student: { $in: targetStudentIds },
          status: 'Accepted',
          type: { $in: qualifyingTypes },
          ctcLpa: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$student',
          highestCtc: { $max: '$ctcLpa' },
        },
      },
      { $sort: { highestCtc: 1 } },
    ]);

    const packages = studentOffersAgg.map((s) => s.highestCtc as number);
    let highestPackageLPA = 0;
    let avgPackageLPA = 0;
    let medianPackageLPA = 0;

    const tierDistribution = {
      Regular: 0,
      Dream: 0,
      'Super Dream': 0,
    };

    if (packages.length > 0) {
      highestPackageLPA = parseFloat(Math.max(...packages).toFixed(2));
      const sum = packages.reduce((acc, val) => acc + val, 0);
      avgPackageLPA = parseFloat((sum / packages.length).toFixed(2));

      // Median Calculation
      const mid = Math.floor(packages.length / 2);
      medianPackageLPA =
        packages.length % 2 !== 0
          ? parseFloat(packages[mid].toFixed(2))
          : parseFloat(((packages[mid - 1] + packages[mid]) / 2).toFixed(2));

      for (const p of packages) {
        const tier = resolveOfferTier(p);
        tierDistribution[tier]++;
      }
    }

    // 6. Placement Drives Statistics
    const driveMatch: Record<string, unknown> = {
      isArchived: { $ne: true },
    };
    if (effectiveBatch) {
      driveMatch.$or = [
        { 'eligibilityRules.allowedBatches': effectiveBatch },
        { 'eligibilityRules.allowedBatches': { $size: 0 } },
        { 'eligibilityRules.allowedBatches': { $exists: false } },
      ];
    }
    const [totalDrives, activeDrives] = await Promise.all([
      Drive.countDocuments(driveMatch),
      Drive.countDocuments({ ...driveMatch, status: { $in: ['Open', 'In Progress'] } }),
    ]);

    // 7. Training Sessions & Scoped Attendance
    const totalSessions = await TrainingSession.countDocuments();

    let deptStudentIds: unknown[] = [];
    if (coordinatorDept) {
      deptStudentIds = targetStudentIds;
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

    // 8. Scoped Average Feedback Rating
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

    // 9. Upcoming Sessions
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
        eligibleOptedInStudents,
        excludedFromPlacementCount,
        placementRate,
        formulaDisplay: PLACEMENT_POLICY_CONFIG.placementPercentageCalculation.formulaDisplay,
        denominatorBasis: PLACEMENT_POLICY_CONFIG.placementPercentageCalculation.denominatorBasis,
        placementDistribution,
        avgPackageLPA,
        highestPackageLPA,
        medianPackageLPA,
        tierDistribution,
        qualifyingPlacedCount: packages.length,
        totalDrives,
        activeDrives,
        selectedBatch: effectiveBatch || 'all',
        totalSessions,
        totalAttendanceRecords,
        overallAttendanceRate,
        totalFeedbacks,
        averageRating,
        departmentDistribution,
        yearDistribution,
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
