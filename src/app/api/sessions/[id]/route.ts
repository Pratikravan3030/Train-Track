import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { updateSessionSchema } from '@/lib/validations/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('sessions', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const trainingSession = await TrainingSession.findById(id);
    if (!trainingSession) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    // Role: STUDENT - view session details ONLY, without attendee roster or others' attendance/feedback
    if (auth.user.role === 'STUDENT') {
      return NextResponse.json(
        {
          session: trainingSession,
          students: [],
          attendance: [],
          feedback: [],
        },
        { status: 200 }
      );
    }

    // Role: DEPT_COORDINATOR - roster and attendance strictly scoped to their assigned department
    if (auth.user.role === 'DEPT_COORDINATOR' || auth.scope === 'own-department') {
      const coordinatorDept = auth.user.department;
      if (!coordinatorDept) {
        return NextResponse.json(
          { error: 'Coordinator profile is missing an assigned department.' },
          { status: 403 }
        );
      }

      const students = await Student.find({
        $or: [{ department: coordinatorDept }, { branch: coordinatorDept }],
      }).sort({ name: 1 });
      const deptStudentIds = students.map((s) => s._id);

      const attendance = await Attendance.find({
        sessionId: id,
        studentId: { $in: deptStudentIds },
      });

      const feedback = await Feedback.find({
        sessionId: id,
        studentId: { $in: deptStudentIds },
      })
        .populate('studentId', 'name rollNumber branch')
        .sort({ createdAt: -1 });

      return NextResponse.json(
        {
          session: trainingSession,
          students,
          attendance,
          feedback,
        },
        { status: 200 }
      );
    }

    // Staff roles (SUPER_ADMIN, TPO) - campus-wide visibility
    const students = await Student.find({}).sort({ name: 1 });
    const attendance = await Attendance.find({ sessionId: id });
    const feedback = await Feedback.find({ sessionId: id })
      .populate('studentId', 'name rollNumber branch')
      .sort({ createdAt: -1 });

    return NextResponse.json(
      {
        session: trainingSession,
        students,
        attendance,
        feedback,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/sessions/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('sessions', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = updateSessionSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid session update';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { title, date, trainer, description } = parseResult.data;
    await dbConnect();

    const updatedSession = await TrainingSession.findByIdAndUpdate(
      id,
      {
        ...(title && { title }),
        ...(date && { date }),
        ...(trainer && { trainer }),
        ...(description !== undefined && { description }),
      },
      { new: true, runValidators: true }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_SESSION',
      resource: 'TrainingSession',
      resourceId: id,
      details: { title: updatedSession.title, trainer: updatedSession.trainer },
    });

    return NextResponse.json(updatedSession, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PUT /api/sessions/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('sessions', 'delete');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const deletedSession = await TrainingSession.findByIdAndDelete(id);
    if (!deletedSession) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    // Cascade delete attendance and feedback for this session
    await Promise.all([
      Attendance.deleteMany({ sessionId: id }),
      Feedback.deleteMany({ sessionId: id }),
    ]);

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_SESSION',
      resource: 'TrainingSession',
      resourceId: id,
      details: { title: deletedSession.title },
    });

    return NextResponse.json({ message: 'Session and related records deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/sessions/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
