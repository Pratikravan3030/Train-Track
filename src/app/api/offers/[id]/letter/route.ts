import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Offer from '@/models/Offer';
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
  const auth = await requirePermission('offers', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const offer = await Offer.findById(id).populate('student');
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const student = offer.student as unknown as { department: string; rollNumber: string };
    if (
      auth.user.role === 'DEPT_COORDINATOR' &&
      !canAccessDepartment(auth.user, student?.department)
    ) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot view offer letters of students in other departments.' },
        { status: 403 }
      );
    }

    const storageKey = offer.offerLetterStorageKey;
    if (!storageKey) {
      return NextResponse.json({ error: 'No offer letter uploaded for this offer.' }, { status: 404 });
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
        { error: 'Offer letter file is missing from storage.' },
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

    const safeFilename = `${student?.rollNumber || 'student'}-offer-letter.pdf`;

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/offers/[id]/letter error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const offer = await Offer.findById(id).populate('student');
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
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

    // Delete previous offer letter object if replacing
    if (offer.offerLetterStorageKey) {
      try {
        await adapter.deleteFile(offer.offerLetterStorageKey);
      } catch (delErr) {
        console.error('[Offer letter replace delete warning]:', delErr);
      }
    }

    const { key } = await adapter.saveFile({
      folder: 'offer-letters',
      buffer,
      contentType: 'application/pdf',
    });

    const relativeUrl = `/api/offers/${id}/letter`;
    offer.offerLetterUrl = relativeUrl;
    offer.offerLetterStorageKey = key;
    offer.offerLetterFilename = file.name || 'offer-letter.pdf';
    await offer.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPLOAD_OFFER_LETTER',
      resource: 'Offer',
      resourceId: id,
      details: { storageKey: key },
    });

    return NextResponse.json(
      {
        message: 'Offer letter uploaded successfully',
        offerLetterUrl: relativeUrl,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/offers/[id]/letter error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const offer = await Offer.findById(id);
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (offer.offerLetterStorageKey) {
      const adapter = getStorageAdapter();
      await adapter.deleteFile(offer.offerLetterStorageKey);
    }

    offer.offerLetterUrl = undefined;
    offer.offerLetterStorageKey = undefined;
    offer.offerLetterFilename = undefined;
    await offer.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_OFFER_LETTER',
      resource: 'Offer',
      resourceId: id,
    });

    return NextResponse.json({ message: 'Offer letter deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/offers/[id]/letter error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
