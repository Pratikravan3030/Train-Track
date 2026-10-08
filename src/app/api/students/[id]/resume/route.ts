import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import {
  getStorageAdapter,
  isValidPdf,
  MAX_FILE_SIZE_BYTES,
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

    const storageKey =
      student.resumeStorageKey ||
      (student.resumeFilename ? `resumes/${student.resumeFilename}` : null);

    if (!storageKey) {
      return NextResponse.json({ error: 'Resume not found for this student' }, { status: 404 });
    }

    const adapter = getStorageAdapter();

    // Check if client requested a signed URL
    const url = new URL(request.url);
    if (url.searchParams.get('signed') === 'true') {
      const signedUrl = await adapter.getSignedDownloadUrl(storageKey, 300);
      if (signedUrl) {
        return NextResponse.redirect(signedUrl, { status: 307 });
      }
    }

    const fileResult = await adapter.getFile(storageKey);
    if (!fileResult) {
      return NextResponse.json(
        { error: 'Resume file is missing or has been removed from storage.' },
        { status: 404 }
      );
    }

    let fileBuffer: Buffer;
    if (fileResult.buffer) {
      fileBuffer = fileResult.buffer;
    } else if (fileResult.stream) {
      const chunks: Buffer[] = [];
      for await (const chunk of fileResult.stream) {
        chunks.push(Buffer.from(chunk));
      }
      fileBuffer = Buffer.concat(chunks);
    } else {
      return NextResponse.json(
        { error: 'Unable to read file content from storage provider.' },
        { status: 500 }
      );
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
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

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds 2MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).` },
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

    const adapter = getStorageAdapter();

    // Delete old resume file if one exists
    const oldKey =
      student.resumeStorageKey ||
      (student.resumeFilename ? `resumes/${student.resumeFilename}` : null);
    if (oldKey) {
      await adapter.deleteFile(oldKey);
    }

    const { key } = await adapter.saveFile({
      folder: 'resumes',
      buffer,
      contentType: 'application/pdf',
    });

    const relativeUrl = `/api/students/${id}/resume`;
    student.resumeUrl = relativeUrl;
    student.resumeStorageKey = key;
    student.resumeFilename = key.split('/').pop() || key;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPLOAD_RESUME',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: student.rollNumber, storageKey: key },
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

    const storageKey =
      student.resumeStorageKey ||
      (student.resumeFilename ? `resumes/${student.resumeFilename}` : null);

    if (storageKey) {
      const adapter = getStorageAdapter();
      await adapter.deleteFile(storageKey);
    }

    student.resumeUrl = undefined;
    student.resumeFilename = undefined;
    student.resumeStorageKey = undefined;
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
