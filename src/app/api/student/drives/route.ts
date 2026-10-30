import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import { requireStudentAuth } from '@/lib/auth-guards';

export async function GET() {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const student = await Student.findById(auth.user.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const now = new Date();

    // Fetch active non-deleted drives (status Open or In Progress, not archived)
    const drives = await Drive.find({
      status: { $in: ['Open', 'In Progress', 'Upcoming', 'Ongoing'] },
      isDeleted: { $ne: true },
      isArchived: { $ne: true },
    })
      .populate('company', 'name website sector')
      .sort({ registrationDeadline: 1, driveDate: 1 });

    const driveIds = drives.map((d) => d._id);

    // Fetch student's existing applications for these drives
    const applications = await Application.find({
      drive: { $in: driveIds },
      student: student._id,
    });

    const appMap = new Map<string, (typeof applications)[number]>();
    applications.forEach((app) => {
      appMap.set(app.drive.toString(), app);
    });

    const enrichedDrives = drives.map((drive) => {
      const driveIdStr = drive._id.toString();
      const existingApp = appMap.get(driveIdStr);

      const allowedDepts: string[] =
        drive.eligibilityRules?.allowedDepartments || drive.eligibleDepartments || [];
      const allowedBatches: number[] =
        drive.eligibilityRules?.allowedBatches || drive.eligibleBatches || [];
      const minCgpa = drive.eligibilityRules?.minCgpa ?? drive.minCgpa;
      const maxBacklogs = drive.eligibilityRules?.maxBacklogs ?? drive.maxBacklogs;
      const deadline = drive.registrationDeadline || drive.deadlineDate;

      const deptMatch =
        allowedDepts.length === 0 || allowedDepts.includes(student.department);

      const batchMatch =
        allowedBatches.length === 0 || allowedBatches.includes(student.passoutYear);

      const cgpa = student.cgpa ?? 0;
      const cgpaMatch = minCgpa == null || cgpa >= minCgpa;

      const backlogs = student.backlogs ?? 0;
      const backlogsMatch = maxBacklogs == null || backlogs <= maxBacklogs;

      const isEligible = deptMatch && batchMatch && cgpaMatch && backlogsMatch;

      const isPastDeadline = deadline ? new Date(deadline) < now : false;

      const applicationStatus = existingApp ? existingApp.status : 'Not Applied';

      const canApply =
        isEligible &&
        !isPastDeadline &&
        (!existingApp || existingApp.status === 'Withdrawn');

      const canWithdraw =
        existingApp &&
        existingApp.status === 'Applied' &&
        !isPastDeadline;

      const reasonsIneligible: string[] = [];
      if (!deptMatch) reasonsIneligible.push(`Department ${student.department} is not eligible`);
      if (!batchMatch) reasonsIneligible.push(`Batch ${student.passoutYear} is not eligible`);
      if (!cgpaMatch) reasonsIneligible.push(`CGPA ${cgpa} is below minimum requirement (${minCgpa})`);
      if (!backlogsMatch) reasonsIneligible.push(`Active backlogs (${backlogs}) exceed limit (${maxBacklogs})`);

      const packageLPA = drive.ctcLpa ?? drive.packageLPA;

      return {
        _id: drive._id,
        title: drive.role ? `${drive.company?.name || 'Drive'} - ${drive.role}` : drive.title,
        company: drive.company,
        role: drive.role,
        type: drive.type,
        packageLPA,
        driveDate: drive.driveDate,
        deadlineDate: deadline,
        status: drive.status,
        minCgpa,
        maxBacklogs,
        eligibleDepartments: allowedDepts,
        eligibleBatches: allowedBatches,
        isEligible,
        reasonsIneligible,
        isPastDeadline,
        applicationStatus,
        applicationId: existingApp ? existingApp._id : null,
        canApply,
        canWithdraw,
      };
    });

    return NextResponse.json({ drives: enrichedDrives }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
