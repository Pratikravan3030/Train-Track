import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const students = await Student.find({}).sort({ name: 1 });
    return NextResponse.json(students, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, rollNumber, branch, year, email } = body;

    if (!name || !rollNumber) {
      return NextResponse.json({ error: 'Name and Roll Number are required fields.' }, { status: 400 });
    }

    await dbConnect();

    // Check unique rollNumber
    const existingStudent = await Student.findOne({ rollNumber: rollNumber.trim() });
    if (existingStudent) {
      return NextResponse.json({ error: `Student with roll number ${rollNumber} already exists.` }, { status: 400 });
    }

    const newStudent = await Student.create({
      name: name.trim(),
      rollNumber: rollNumber.trim(),
      branch: branch?.trim() || '',
      year: year?.trim() || '',
      email: email?.trim() || '',
    });

    return NextResponse.json(newStudent, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
