import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import Notification from '@/models/Notification';
import { requireStudentAuth } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id: driveId } = await params;
    await dbConnect();

    const [student, drive] = await Promise.all([
      Student.findById(auth.user.studentId),
      Drive.findById(driveId),
    ]);

    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    if (!drive) {
      return NextResponse.json({ error: 'Placement drive not found' }, { status: 404 });
    }

    // 1. Deadline Check (IST)
    const deadline = drive.registrationDeadline || drive.deadlineDate;
    if (deadline && new Date(deadline) < new Date()) {
      return NextResponse.json(
        { error: 'Cannot withdraw after the application deadline has passed.' },
        { status: 400 }
      );
    }

    // 2. Find application
    const application = await Application.findOne({
      drive: drive._id,
      student: student._id,
    });

    if (!application) {
      return NextResponse.json(
        { error: 'No active application found for this drive.' },
        { status: 404 }
      );
    }

    if (application.status === 'Withdrawn') {
      return NextResponse.json(
        { error: 'Application is already withdrawn.' },
        { status: 400 }
      );
    }

    // Students can only self-withdraw if still in 'Applied' status
    if (application.status !== 'Applied') {
      return NextResponse.json(
        {
          error: `Cannot withdraw once application processing has commenced (Current status: ${application.status}). Please contact the T&P Cell for assistance.`,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    application.status = 'Withdrawn';
    application.statusHistory.push({
      status: 'Withdrawn',
      roundIndex: application.currentRoundIndex || 0,
      changedBy: new mongoose.Types.ObjectId(auth.user.id),
      reason: 'Withdrawn by student',
      changedAt: now,
    });

    await application.save();

    // In-app notification
    await Notification.create({
      userId: auth.user.id,
      studentId: student._id,
      title: 'Drive Application Withdrawn',
      message: `You have successfully withdrawn your application for ${drive.title}.`,
      type: 'drive',
    });

    // Audit log
    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'WITHDRAW_DRIVE',
      resource: 'Application',
      resourceId: application._id.toString(),
      details: {
        driveId: drive._id.toString(),
        driveTitle: drive.title,
        studentId: student._id.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Application withdrawn successfully.',
      application,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
