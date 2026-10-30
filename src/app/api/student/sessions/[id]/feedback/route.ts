import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requireStudentAuth } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const feedbackInputSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().trim().max(1000, 'Comment cannot exceed 1000 characters').optional().default(''),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const parseResult = feedbackInputSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'Invalid feedback data';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { rating, comment } = parseResult.data;

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

    // 1. Verify student attended this session
    const attendance = await Attendance.findOne({
      sessionId: session._id,
      studentId: student._id,
      present: true,
    });

    if (!attendance) {
      return NextResponse.json(
        { error: 'Feedback can only be submitted for sessions you have attended.' },
        { status: 400 }
      );
    }

    // 2. Strictly ONE feedback per student per attended session
    const existingFeedback = await Feedback.findOne({
      sessionId: session._id,
      studentId: student._id,
    });

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'You have already submitted feedback for this session.' },
        { status: 409 }
      );
    }

    // 3. Create feedback
    const feedback = await Feedback.create({
      sessionId: session._id,
      studentId: student._id,
      source: 'student',
      rating,
      comment,
    });

    // Audit log
    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'FEEDBACK_SUBMITTED',
      resource: 'TrainingSession',
      resourceId: session._id.toString(),
      details: {
        studentId: student._id.toString(),
        rating,
        sessionTitle: session.title,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Feedback submitted successfully.',
        feedback,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
