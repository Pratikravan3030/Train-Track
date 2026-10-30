import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { requireStudentAuth } from '@/lib/auth-guards';

export async function GET() {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const userObjectId = new mongoose.Types.ObjectId(auth.user.id);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ userId: userObjectId, read: false }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH() {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const userObjectId = new mongoose.Types.ObjectId(auth.user.id);

    await Notification.updateMany(
      { userId: userObjectId, read: false },
      { $set: { read: true } }
    );

    return NextResponse.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
