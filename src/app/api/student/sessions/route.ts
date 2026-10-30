import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requireStudentAuth } from '@/lib/auth-guards';

export async function GET() {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const student = await Student.findById(auth.user.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const now = new Date();

    // Query non-deleted sessions eligible for student's department and batch
    const sessions = await TrainingSession.find({
      isDeleted: { $ne: true },
      $and: [
        {
          $or: [
            { targetDepartments: { $exists: false } },
            { targetDepartments: { $size: 0 } },
            { targetDepartments: student.department },
          ],
        },
        {
          $or: [
            { targetBatches: { $exists: false } },
            { targetBatches: { $size: 0 } },
            { targetBatches: student.passoutYear },
          ],
        },
      ],
    }).sort({ date: -1 });

    const sessionIds = sessions.map((s) => s._id);

    // Fetch attendance and feedback for this student
    const [attendances, feedbacks] = await Promise.all([
      Attendance.find({
        sessionId: { $in: sessionIds },
        studentId: student._id,
      }),
      Feedback.find({
        sessionId: { $in: sessionIds },
        studentId: student._id,
      }),
    ]);

    const attendanceMap = new Map<string, (typeof attendances)[number]>();
    attendances.forEach((a) => attendanceMap.set(a.sessionId.toString(), a));

    const feedbackMap = new Map<string, (typeof feedbacks)[number]>();
    feedbacks.forEach((f) => feedbackMap.set(f.sessionId.toString(), f));

    const enrichedSessions = sessions.map((session) => {
      const sessionIdStr = session._id.toString();
      const attendance = attendanceMap.get(sessionIdStr);
      const feedback = feedbackMap.get(sessionIdStr);

      const hasAttended = attendance ? Boolean(attendance.present) : false;
      const attendanceStatus = attendance ? attendance.status || (attendance.present ? 'Present' : 'Absent') : 'Not Marked';

      const checkInActive = Boolean(
        session.checkInCode &&
          session.checkInCodeExpiresAt &&
          new Date(session.checkInCodeExpiresAt) > now
      );

      return {
        _id: session._id,
        title: session.title,
        date: session.date,
        trainer: session.trainer,
        description: session.description,
        category: session.category,
        venue: session.venue,
        targetDepartments: session.targetDepartments,
        targetBatches: session.targetBatches,
        checkInActive,
        hasAttended,
        attendanceStatus,
        hasSubmittedFeedback: Boolean(feedback),
        feedback: feedback
          ? {
              rating: feedback.rating,
              comment: feedback.comment,
              createdAt: feedback.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({ sessions: enrichedSessions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
