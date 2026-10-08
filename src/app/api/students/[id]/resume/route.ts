import { NextResponse } from 'next/server';
import fs from 'fs';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import {
  saveResume,
  getResumeFilePath,
  deleteResumeFile,
  MAX_RESUME_SIZE_BYTES,
  isValidPdf,
} from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('students', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const student = await Student.findById(id);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Role-based scoping
    if (auth.user.role === 'STUDENT' && auth.user.studentId !== id) {
      return NextResponse.json(
        { error: 'Forbidden. Students may only access their own resume.' },
        { status: 403 }
      );
    }

    if (
      auth.user.role === 'DEPT_COORDINATOR' &&
      !canAccessDepartment(auth.user, student.department || student.branch)
    ) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot view resumes of students in other departments.' },
        { status: 403 }
      );
    }

    if (!student.resumeFilename) {
      return NextResponse.json({ error: 'Resume not found for this student' }, { status: 404 });
    }

    const filePath = getResumeFilePath(student.resumeFilename);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Resume file is missing or has been removed from storage.' },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.promises.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${student.rollNumber}-resume.pdf"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/students/[id]/resume error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('students', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const student = await Student.findById(id);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Scoping check
    if (auth.user.role === 'STUDENT' && auth.user.studentId !== id) {
      return NextResponse.json(
        { error: 'Forbidden. Students may only upload their own resume.' },
        { status: 403 }
      );
    }

    if (
      auth.user.role === 'DEPT_COORDINATOR' &&
      !canAccessDepartment(auth.user, student.department || student.branch)
    ) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot upload resumes for students outside your department.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isValidPdf(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file format. Uploaded file must be a valid PDF document.' },
        { status: 400 }
      );
    }

    // Delete old resume file if one exists
    if (student.resumeFilename) {
      await deleteResumeFile(student.resumeFilename);
    }

    const { filename, relativeUrl } = await saveResume(id, buffer);

    student.resumeUrl = relativeUrl;
    student.resumeFilename = filename;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPLOAD_RESUME',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: student.rollNumber, filename },
    });

    return NextResponse.json(
      {
        message: 'Resume uploaded successfully',
        resumeUrl: relativeUrl,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/students/[id]/resume error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('students', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const student = await Student.findById(id);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    if (auth.user.role === 'STUDENT' && auth.user.studentId !== id) {
      return NextResponse.json(
        { error: 'Forbidden. Students may only delete their own resume.' },
        { status: 403 }
      );
    }

    if (
      auth.user.role === 'DEPT_COORDINATOR' &&
      !canAccessDepartment(auth.user, student.department || student.branch)
    ) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot delete resumes for students outside your department.' },
        { status: 403 }
      );
    }

    if (student.resumeFilename) {
      await deleteResumeFile(student.resumeFilename);
    }

    student.resumeUrl = undefined;
    student.resumeFilename = undefined;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_RESUME',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: student.rollNumber },
    });

    return NextResponse.json({ message: 'Resume deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/students/[id]/resume error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
