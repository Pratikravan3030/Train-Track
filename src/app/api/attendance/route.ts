import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const attendance = await Attendance.find({ sessionId }).populate('studentId', 'name rollNumber branch');
    return NextResponse.json(attendance, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, records } = body;

    if (!sessionId || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Session ID and attendance records array are required.' }, { status: 400 });
    }

    await dbConnect();

    // Prepare bulk operations for upserting attendance records
    const bulkOps = records.map((record: { studentId: string; present: boolean }) => ({
      updateOne: {
        filter: { sessionId, studentId: record.studentId },
        update: { $set: { present: record.present, markedAt: new Date() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    return NextResponse.json({ message: 'Attendance updated successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
