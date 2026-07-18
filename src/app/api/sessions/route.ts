import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const sessions = await TrainingSession.find({}).sort({ date: -1 });
    return NextResponse.json(sessions, { status: 200 });
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
    const { title, date, trainer, description } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and Date are required fields.' }, { status: 400 });
    }

    await dbConnect();

    const newSession = await TrainingSession.create({
      title: title.trim(),
      date: new Date(date),
      trainer: trainer?.trim() || '',
      description: description?.trim() || '',
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
