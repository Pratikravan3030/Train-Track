import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission } from '@/lib/auth-guards';

export async function GET() {
  // SUPER_ADMIN only via central RBAC policy
  const auth = await requirePermission('health', 'read');
  if (!auth.authorized) return auth.response;

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
    users: 0,
    students: 0,
    trainingsessions: 0,
    attendances: 0,
    feedbacks: 0,
  };

  try {
    const mongooseInstance = await dbConnect();
    dbConnected = mongooseInstance.connection.readyState === 1;

    const [usersCount, studentsCount, sessionsCount, attendanceCount, feedbackCount] = await Promise.all([
      User.countDocuments(),
      Student.countDocuments(),
      TrainingSession.countDocuments(),
      Attendance.countDocuments(),
      Feedback.countDocuments(),
    ]);

    counts = {
      users: usersCount,
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
          envStatus.NEXTAUTH_URL,
      },
    },
    { status: 200 }
  );
}
