import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function GET() {
  try {
    await dbConnect();
    const adminCount = await User.countDocuments({ role: 'SUPER_ADMIN' });
    return NextResponse.json({
      hasAdmin: adminCount > 0,
      adminCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database check failed';
    return NextResponse.json(
      { hasAdmin: false, error: message },
      { status: 500 }
    );
  }
}
