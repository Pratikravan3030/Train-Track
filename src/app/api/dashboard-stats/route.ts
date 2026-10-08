import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Feedback from '@/models/Feedback';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();

    // 1. Get Total Students count
    const totalStudents = await Student.countDocuments();

    // 2. Get Total Sessions count
    const totalSessions = await TrainingSession.countDocuments();

    // 3. Get Overall Average Feedback Rating
    const overallAvgObj = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' }
        }
      }
    ]);
    const averageRating = overallAvgObj.length > 0 ? parseFloat(overallAvgObj[0].averageRating.toFixed(2)) : 0;

    // 4. Session Average Ratings (ordered by date for Recharts timeline)
    const sessions = await TrainingSession.find({}).sort({ date: 1 });
    const feedbackStats = await Feedback.aggregate([
      {
        $group: {
          _id: '$sessionId',
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const ratingsMap = new Map(feedbackStats.map(f => [f._id.toString(), f.averageRating]));

    const sessionRatings = sessions.map(session => ({
      id: session._id.toString(),
      title: session.title,
      date: session.date,
      averageRating: parseFloat((ratingsMap.get(session._id.toString()) || 0).toFixed(2))
    }));

    // 5. Get Upcoming Sessions (from today onwards)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingSessions = await TrainingSession.find({
      date: { $gte: today }
    })
      .sort({ date: 1 })
      .limit(5);

    return NextResponse.json({
      totalStudents,
      totalSessions,
      averageRating,
      sessionRatings,
      upcomingSessions
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
