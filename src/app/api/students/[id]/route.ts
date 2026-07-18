import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
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
    const student = await Student.findById(id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch student's attendance history
    const attendance = await Attendance.find({ studentId: id })
      .populate('sessionId', 'title date trainer')
      .sort({ markedAt: -1 });

    // Fetch student's feedback history
    const feedback = await Feedback.find({ studentId: id })
      .populate('sessionId', 'title date')
      .sort({ createdAt: -1 });

    return NextResponse.json({ student, attendance, feedback }, { status: 200 });
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
    const { name, rollNumber, branch, year, email } = body;

    if (!name || !rollNumber) {
      return NextResponse.json({ error: 'Name and Roll Number are required fields.' }, { status: 400 });
    }

    await dbConnect();

    // Check unique rollNumber excluding current student
    const existingStudent = await Student.findOne({
      rollNumber: rollNumber.trim(),
      _id: { $ne: id }
    });
    if (existingStudent) {
      return NextResponse.json({ error: `Student with roll number ${rollNumber} already exists.` }, { status: 400 });
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        branch: branch?.trim() || '',
        year: year?.trim() || '',
        email: email?.trim() || '',
      },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(updatedStudent, { status: 200 });
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

    const deletedStudent = await Student.findByIdAndDelete(id);
    if (!deletedStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Cascade delete attendance and feedback
    await Attendance.deleteMany({ studentId: id });
    await Feedback.deleteMany({ studentId: id });

    return NextResponse.json({ message: 'Student and related records deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
