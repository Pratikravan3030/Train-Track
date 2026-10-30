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
      Drive.findById(driveId).populate('company', 'name'),
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
        { error: 'Application deadline has passed. Late applications are not accepted.' },
        { status: 400 }
      );
    }

    // 2. Department & Batch Eligibility
    const allowedDepts: string[] =
      drive.eligibilityRules?.allowedDepartments || drive.eligibleDepartments || [];
    if (allowedDepts.length > 0 && !allowedDepts.includes(student.department)) {
      return NextResponse.json(
        { error: `Ineligible: Drive is restricted to departments: ${allowedDepts.join(', ')}` },
        { status: 400 }
      );
    }

    const allowedBatches: number[] =
      drive.eligibilityRules?.allowedBatches || drive.eligibleBatches || [];
    if (allowedBatches.length > 0 && !allowedBatches.includes(student.passoutYear)) {
      return NextResponse.json(
        { error: `Ineligible: Drive is restricted to graduating batch(es): ${allowedBatches.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Academic Criteria (CGPA & Backlogs)
    const minCgpa = drive.eligibilityRules?.minCgpa ?? drive.minCgpa;
    const cgpa = student.cgpa ?? 0;
    if (minCgpa != null && cgpa < minCgpa) {
      return NextResponse.json(
        { error: `Ineligible: Student CGPA (${cgpa}) is below required minimum (${minCgpa}).` },
        { status: 400 }
      );
    }

    const maxBacklogs = drive.eligibilityRules?.maxBacklogs ?? drive.maxBacklogs;
    const backlogs = student.backlogs ?? 0;
    if (maxBacklogs != null && backlogs > maxBacklogs) {
      return NextResponse.json(
        { error: `Ineligible: Student active backlogs (${backlogs}) exceed allowed maximum (${maxBacklogs}).` },
        { status: 400 }
      );
    }

    // 4. Duplicate Check
    const existingApp = await Application.findOne({
      drive: drive._id,
      student: student._id,
    });

    if (existingApp && existingApp.status !== 'Withdrawn') {
      return NextResponse.json(
        { error: `You have already applied to this drive. Current status: ${existingApp.status}` },
        { status: 409 }
      );
    }

    let application;
    const now = new Date();
    const userObjectId = new mongoose.Types.ObjectId(auth.user.id);

    if (existingApp) {
      // Re-applying after prior withdrawal
      existingApp.status = 'Applied';
      existingApp.statusHistory = existingApp.statusHistory || [];
      existingApp.statusHistory.push({
        status: 'Applied',
        roundIndex: existingApp.currentRoundIndex || 0,
        changedBy: userObjectId,
        reason: 'Student re-applied before deadline',
        changedAt: now,
      });
      application = await existingApp.save();
    } else {
      application = await Application.create({
        drive: drive._id,
        student: student._id,
        status: 'Applied',
        currentRoundIndex: 0,
        registeredBy: userObjectId,
        eligibilitySnapshot: {
          isEligible: true,
          ineligibilityReasons: [],
          cgpa: student.cgpa ?? null,
          backlogs: student.backlogs ?? null,
          tenthPercentage: student.tenthPercentage ?? null,
          twelfthOrDiplomaPercentage: student.twelfthOrDiplomaPercentage ?? null,
          department: student.department,
          passoutYear: student.passoutYear,
          evaluatedAt: now,
          policyCheck: {
            passesPolicy: true,
          },
        },
        statusHistory: [
          {
            status: 'Applied',
            roundIndex: 0,
            changedBy: userObjectId,
            reason: 'Student self-service application via student portal',
            changedAt: now,
          },
        ],
      });
    }

    // Create in-app confirmation notification
    await Notification.create({
      userId: auth.user.id,
      studentId: student._id,
      title: 'Application Submitted',
      message: `Your application for ${drive.company?.name || 'Drive'} (${drive.role}) has been submitted successfully.`,
      link: `/student/drives`,
      type: 'drive',
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'APPLY_DRIVE',
      resource: 'Application',
      resourceId: application._id.toString(),
      details: {
        driveId: drive._id.toString(),
        studentId: student._id.toString(),
        rollNumber: student.rollNumber,
      },
    });

    return NextResponse.json(
      { success: true, application, message: 'Application submitted successfully!' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
