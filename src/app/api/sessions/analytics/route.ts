import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission } from '@/lib/auth-guards';

export async function GET() {
  const auth = await requirePermission('sessions', 'read');
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();

    // 1. Fetch non-deleted training sessions
    const sessions = await TrainingSession.find({ isDeleted: { $ne: true } }).lean();
    const sessionIds = sessions.map((s) => s._id);

    // 2. Fetch attendance & feedback data
    const [attendances, feedbacks] = await Promise.all([
      Attendance.find({ sessionId: { $in: sessionIds } }).lean(),
      Feedback.find({ sessionId: { $in: sessionIds } }).lean(),
    ]);

    // Map attendance counts per session
    const sessionAttendanceMap = new Map<string, { total: number; present: number }>();
    attendances.forEach((a) => {
      const sId = a.sessionId.toString();
      if (!sessionAttendanceMap.has(sId)) {
        sessionAttendanceMap.set(sId, { total: 0, present: 0 });
      }
      const item = sessionAttendanceMap.get(sId)!;
      item.total++;
      if (a.present) item.present++;
    });

    // Map feedback ratings per session
    const sessionFeedbackMap = new Map<string, number[]>();
    feedbacks.forEach((f) => {
      const sId = f.sessionId.toString();
      if (!sessionFeedbackMap.has(sId)) {
        sessionFeedbackMap.set(sId, []);
      }
      if (f.rating) sessionFeedbackMap.get(sId)!.push(f.rating);
    });

    // 3. Group by Trainer
    interface TrainerStatAccumulator {
      sessionsCount: number;
      totalEligible: number;
      totalPresent: number;
      ratings: number[];
      categories: Set<string>;
    }

    const trainerMap = new Map<string, TrainerStatAccumulator>();

    sessions.forEach((s) => {
      const trainer = s.trainer?.trim() || 'Guest Trainer';
      if (!trainerMap.has(trainer)) {
        trainerMap.set(trainer, {
          sessionsCount: 0,
          totalEligible: 0,
          totalPresent: 0,
          ratings: [],
          categories: new Set<string>(),
        });
      }
      const item = trainerMap.get(trainer)!;
      item.sessionsCount++;
      if (s.category) item.categories.add(s.category);

      const att = sessionAttendanceMap.get(s._id.toString()) || { total: 0, present: 0 };
      item.totalEligible += att.total;
      item.totalPresent += att.present;

      const fbs = sessionFeedbackMap.get(s._id.toString()) || [];
      item.ratings.push(...fbs);
    });

    const trainerAnalytics = Array.from(trainerMap.entries()).map(([trainer, data]) => {
      const avgRate =
        data.totalEligible > 0
          ? parseFloat(((data.totalPresent / data.totalEligible) * 100).toFixed(1))
          : 0;
      const avgRating =
        data.ratings.length > 0
          ? parseFloat(
              (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(2)
            )
          : 0;

      return {
        trainer,
        sessionsCount: data.sessionsCount,
        totalStudentsAttended: data.totalPresent,
        averageAttendanceRate: avgRate,
        averageFeedbackRating: avgRating,
        feedbackCount: data.ratings.length,
        categories: Array.from(data.categories),
      };
    });

    // 4. Category Distribution
    const categoryCountMap = new Map<string, number>();
    sessions.forEach((s) => {
      const cat = s.category || 'Technical';
      categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);
    });
    const categoryDistribution = Array.from(categoryCountMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    return NextResponse.json({
      trainerAnalytics,
      categoryDistribution,
      totalSessions: sessions.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/sessions/analytics error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
