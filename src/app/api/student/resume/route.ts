import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requireStudentAuth } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { saveResume, isValidPdf, MAX_FILE_SIZE_BYTES } from '@/lib/storage';

export async function POST(request: Request) {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const student = await Student.findById(auth.user.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const contentTypeHeader = request.headers.get('content-type') || '';
    let buffer: Buffer;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded in form data' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds 2MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    if (!isValidPdf(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file format. Only valid PDF files are permitted.' },
        { status: 400 }
      );
    }

    const { filename, relativeUrl, key } = await saveResume(student._id.toString(), buffer);

    student.resumeFilename = filename;
    student.resumeUrl = relativeUrl;
    student.resumeStorageKey = key;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPLOAD_RESUME',
      resource: 'Student',
      resourceId: student._id.toString(),
      details: { rollNumber: student.rollNumber, storageKey: key },
    });

    return NextResponse.json(
      { success: true, resumeUrl: relativeUrl, filename },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
