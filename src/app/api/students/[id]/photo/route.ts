import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import {
  getStorageAdapter,
  isValidImage,
  MAX_FILE_SIZE_BYTES,
  savePhoto,
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

    if (auth.user.role === 'STUDENT' && auth.user.studentId !== id) {
      return NextResponse.json(
        { error: 'Forbidden. Students may only access their own profile photo.' },
        { status: 403 }
      );
    }

    if (
      auth.user.role === 'DEPT_COORDINATOR' &&
      !canAccessDepartment(auth.user, student.department || student.branch)
    ) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot view photos of students in other departments.' },
        { status: 403 }
      );
    }

    const storageKey = student.photoStorageKey;
    if (!storageKey) {
      return NextResponse.json({ error: 'Photo not found for this student' }, { status: 404 });
    }

    const adapter = getStorageAdapter();
    const fileResult = await adapter.getFile(storageKey);
    if (!fileResult) {
      return NextResponse.json(
        { error: 'Photo file is missing or has been removed from storage.' },
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
        { error: 'Unable to read photo from storage provider.' },
        { status: 500 }
      );
    }

    const contentType = fileResult.contentType || 'image/jpeg';

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/students/[id]/photo error]:', message);
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

    if (auth.user.role === 'STUDENT' && auth.user.studentId !== id) {
      return NextResponse.json(
        { error: 'Forbidden. Students may only upload their own profile photo.' },
        { status: 403 }
      );
    }

    if (
      auth.user.role === 'DEPT_COORDINATOR' &&
      !canAccessDepartment(auth.user, student.department || student.branch)
    ) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot upload photos for students in other departments.' },
        { status: 403 }
      );
    }

    const contentTypeHeader = request.headers.get('content-type') || '';
    let buffer: Buffer;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No image file provided in form data' }, { status: 400 });
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

    const { key, relativeUrl } = await savePhoto(id, buffer);

    student.photoStorageKey = key;
    student.photoUrl = relativeUrl;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPLOAD_PHOTO',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: student.rollNumber, storageKey: key },
    });

    return NextResponse.json(
      { success: true, photoUrl: relativeUrl, storageKey: key },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/students/[id]/photo error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
