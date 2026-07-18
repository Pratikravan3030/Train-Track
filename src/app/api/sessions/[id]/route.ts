import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | any }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await dbConnect();

    const trainingSession = await TrainingSession.findById(id);
    if (!trainingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch all students to render the checklist
    const students = await Student.find({}).sort({ name: 1 });

    // Fetch marked attendance for this session
    const attendance = await Attendance.find({ sessionId: id });

    // Fetch feedback logs for this session
    const feedback = await Feedback.find({ sessionId: id })
      .populate('studentId', 'name rollNumber')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      session: trainingSession,
      students,
      attendance,
      feedback
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> | any }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    const { title, date, trainer, description } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and Date are required fields.' }, { status: 400 });
    }

    await dbConnect();

    const updatedSession = await TrainingSession.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        date: new Date(date),
        trainer: trainer?.trim() || '',
        description: description?.trim() || '',
      },
      { new: true, runValidators: true }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(updatedSession, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | any }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await dbConnect();

    const deletedSession = await TrainingSession.findByIdAndDelete(id);
    if (!deletedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Cascade delete attendance and feedback for this session
    await Attendance.deleteMany({ sessionId: id });
    await Feedback.deleteMany({ sessionId: id });

    return NextResponse.json({ message: 'Session and related records deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
