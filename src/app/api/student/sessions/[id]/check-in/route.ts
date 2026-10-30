import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Notification from '@/models/Notification';
import { requireStudentAuth } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!code) {
      return NextResponse.json(
        { error: 'Check-in code is required.' },
        { status: 400 }
      );
    }

    await dbConnect();
    const [student, session] = await Promise.all([
      Student.findById(auth.user.studentId),
      TrainingSession.findById(sessionId),
    ]);

    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    if (!session || session.isDeleted) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    // 1. Validate Code Expiration & Match (Time-limited code, zero geolocation)
    const now = new Date();
    if (!session.checkInCode || !session.checkInCodeExpiresAt || new Date(session.checkInCodeExpiresAt) < now) {
      return NextResponse.json(
        { error: 'The check-in window for this session is currently closed or expired.' },
        { status: 400 }
      );
    }

    if (session.checkInCode.trim().toUpperCase() !== code) {
      return NextResponse.json(
        { error: 'Invalid check-in code. Please verify the code displayed by the trainer.' },
        { status: 400 }
      );
    }

    // 2. Department & Batch Eligibility
    if (
      session.targetDepartments &&
      session.targetDepartments.length > 0 &&
      !session.targetDepartments.includes(student.department)
    ) {
      return NextResponse.json(
        { error: `Ineligible: This session is targeted to departments: ${session.targetDepartments.join(', ')}` },
        { status: 403 }
      );
    }

    if (
      session.targetBatches &&
      session.targetBatches.length > 0 &&
      !session.targetBatches.includes(student.passoutYear)
    ) {
      return NextResponse.json(
        { error: `Ineligible: This session is targeted to batches: ${session.targetBatches.join(', ')}` },
        { status: 403 }
      );
    }

    // 3. Upsert Attendance record
    const attendance = await Attendance.findOneAndUpdate(
      { sessionId: session._id, studentId: student._id },
      {
        $set: {
          present: true,
          status: 'Present',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    // In-app notification
    await Notification.create({
      userId: auth.user.id,
      studentId: student._id,
      title: 'Session Check-In Confirmed',
      message: `You have successfully checked in for "${session.title}".`,
      type: 'session',
    });

    // Audit log
    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'TRAINING_CHECKIN',
      resource: 'TrainingSession',
      resourceId: session._id.toString(),
      details: {
        studentId: student._id.toString(),
        sessionTitle: session.title,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully checked in for "${session.title}".`,
      attendance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
