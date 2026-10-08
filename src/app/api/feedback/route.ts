import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import Feedback from '@/models/Feedback';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  try {
    await dbConnect();
    const filter = sessionId ? { sessionId } : {};
    const feedback = await Feedback.find(filter)
      .populate('sessionId', 'title date')
      .populate('studentId', 'name rollNumber')
      .sort({ createdAt: -1 });

    return NextResponse.json(feedback, { status: 200 });
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
    const { sessionId, studentId, rating, comment } = body;

    if (!sessionId || !rating) {
      return NextResponse.json({ error: 'Session ID and Rating are required fields.' }, { status: 400 });
    }

    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'Rating must be a number between 1 and 5.' }, { status: 400 });
    }

    await dbConnect();

    const newFeedback = await Feedback.create({
      sessionId,
      studentId: studentId || null,
      rating: ratingNum,
      comment: comment?.trim() || '',
    });

    return NextResponse.json(newFeedback, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
