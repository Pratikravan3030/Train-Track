import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to access system health diagnostics.' },
      { status: 401 }
    );
  }

  const envStatus = {
    MONGODB_URI: Boolean(process.env.MONGODB_URI),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL),
    ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
    VERCEL: Boolean(process.env.VERCEL),
    NODE_ENV: process.env.NODE_ENV || 'unknown',
  };

  let dbConnected = false;
  let dbError: string | null = null;
  let counts = {
    students: 0,
    trainingsessions: 0,
    attendances: 0,
    feedbacks: 0,
  };

  try {
    const mongooseInstance = await dbConnect();
    dbConnected = mongooseInstance.connection.readyState === 1;

    const [studentsCount, sessionsCount, attendanceCount, feedbackCount] = await Promise.all([
      Student.countDocuments(),
      TrainingSession.countDocuments(),
      Attendance.countDocuments(),
      Feedback.countDocuments(),
    ]);

    counts = {
      students: studentsCount,
      trainingsessions: sessionsCount,
      attendances: attendanceCount,
      feedbacks: feedbackCount,
    };
  } catch (err: unknown) {
    dbConnected = false;
    dbError = err instanceof Error ? err.message : 'Failed to connect to database';
    console.error('[Health Check Error] Database query failed:', dbError);
  }

  const isHealthy = dbConnected && envStatus.MONGODB_URI && envStatus.NEXTAUTH_SECRET;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        error: dbError,
        counts,
      },
      environment: {
        configuredVariables: envStatus,
        allRequiredEnvVarsPresent:
          envStatus.MONGODB_URI &&
          envStatus.NEXTAUTH_SECRET &&
          envStatus.NEXTAUTH_URL &&
          envStatus.ADMIN_EMAIL &&
          envStatus.ADMIN_PASSWORD,
      },
    },
    { status: 200 }
  );
}
