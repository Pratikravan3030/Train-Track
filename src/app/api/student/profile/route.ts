import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Offer from '@/models/Offer';
import Attendance from '@/models/Attendance';
import { requireStudentAuth } from '@/lib/auth-guards';
import { calculateProfileCompleteness } from '@/lib/profile-completeness';
import { z } from 'zod';
import {
  certificationSchema,
  projectSchema,
  internshipSchema,
  socialLinksSchema,
} from '@/lib/validations/student';

const FORBIDDEN_FIELDS = [
  'cgpa',
  'backlogs',
  'department',
  'branch',
  'passoutYear',
  'year',
  'rollNumber',
  'placementStatus',
  'tier',
  'isDeleted',
  'isDemoData',
];

const studentSelfUpdateSchema = z.object({
  division: z.string().trim().max(10).optional(),
  skills: z.array(z.string().trim()).optional(),
  certifications: z.array(certificationSchema).optional(),
  projects: z.array(projectSchema).optional(),
  internships: z.array(internshipSchema).optional(),
  socialLinks: socialLinksSchema.optional(),
});

export async function GET() {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const student = await Student.findById(auth.user.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const studentObj = student.toObject ? student.toObject() : student;
    const completeness = calculateProfileCompleteness(studentObj);

    // Fetch student's offers and attendance summary
    const [offers, attendanceRecords] = await Promise.all([
      Offer.find({ student: student._id }).sort({ createdAt: -1 }),
      Attendance.find({ studentId: student._id }),
    ]);

    const totalSessions = attendanceRecords.length;
    const attendedSessions = attendanceRecords.filter((a) => a.present).length;
    const attendancePercentage =
      totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

    return NextResponse.json({
      student: studentObj,
      completeness,
      offers,
      attendanceSummary: {
        totalSessions,
        attendedSessions,
        attendancePercentage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();

    // Check for forbidden academic or authority field tampering
    for (const field of FORBIDDEN_FIELDS) {
      if (field in body) {
        return NextResponse.json(
          { error: `${field} cannot be modified by student` },
          { status: 400 }
        );
      }
    }

    const parseResult = studentSelfUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid update data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    await dbConnect();
    const student = await Student.findById(auth.user.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const { division, skills, certifications, projects, internships, socialLinks } =
      parseResult.data;

    if (division !== undefined) student.division = division;
    if (skills !== undefined) student.skills = skills;
    if (certifications !== undefined) student.certifications = certifications;
    if (projects !== undefined) student.projects = projects;
    if (internships !== undefined) student.internships = internships;
    if (socialLinks !== undefined) student.socialLinks = socialLinks;

    await student.save();

    const studentObj = student.toObject ? student.toObject() : student;
    const completeness = calculateProfileCompleteness(studentObj);

    return NextResponse.json({
      success: true,
      student: studentObj,
      completeness,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
