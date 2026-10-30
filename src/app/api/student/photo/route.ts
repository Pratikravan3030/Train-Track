import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requireStudentAuth } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { savePhoto, isValidImage, MAX_FILE_SIZE_BYTES } from '@/lib/storage';

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
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Uploaded photo is empty.' }, { status: 400 });
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Photo exceeds 2MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)` },
        { status: 400 }
      );
    }

    const { valid } = isValidImage(buffer);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid image format. Allowed formats: JPEG, PNG, WebP.' },
        { status: 400 }
      );
    }

    const { key, relativeUrl } = await savePhoto(student._id.toString(), buffer);

    student.photoStorageKey = key;
    student.photoUrl = relativeUrl;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPLOAD_PHOTO',
      resource: 'Student',
      resourceId: student._id.toString(),
      details: { rollNumber: student.rollNumber, storageKey: key },
    });

    return NextResponse.json(
      { success: true, photoUrl: relativeUrl, storageKey: key },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
