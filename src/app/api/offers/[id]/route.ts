import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Offer from '@/models/Offer';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { getStorageAdapter } from '@/lib/storage';
import { syncStudentPlacementStatusFromOffers } from '@/lib/offerSync';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const offer = await Offer.findById(id)
      .populate('student', 'name rollNumber prn department passoutYear cgpa placementStatus')
      .populate('drive', 'role type driveDate')
      .lean();

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Role-based department scoping for DEPT_COORDINATOR
    if (auth.user.role === 'DEPT_COORDINATOR') {
      const student = offer.student as unknown as { department: string };
      if (!student || student.department !== auth.user.department) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view offers outside your department.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(offer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/offers/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'delete');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const offer = await Offer.findById(id);
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const studentId = offer.student;

    // Delete stored offer letter object if present
    if (offer.offerLetterStorageKey) {
      try {
        const storage = getStorageAdapter();
        await storage.deleteFile(offer.offerLetterStorageKey);
      } catch (storageErr) {
        console.error('[Offer Letter storage delete warning]:', storageErr);
      }
    }

    await Offer.findByIdAndDelete(id);

    // Resynchronize student placement status and cache
    await syncStudentPlacementStatusFromOffers(studentId, {
      reason: 'Offer record was deleted',
      userId: auth.user.id,
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_OFFER',
      resource: 'Offer',
      resourceId: id,
      details: {
        studentId: studentId.toString(),
        companyName: offer.companyName,
        role: offer.role,
      },
    });

    return NextResponse.json({ message: 'Offer deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/offers/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
