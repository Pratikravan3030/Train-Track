import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Offer from '@/models/Offer';
import Application from '@/models/Application';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { reversalOfferSchema } from '@/lib/validations/offer';
import { syncStudentPlacementStatusFromOffers } from '@/lib/offerSync';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('offers', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = reversalOfferSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { status, reason } = parseResult.data;
    await dbConnect();

    const offer = await Offer.findById(id);
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const previousStatus = offer.status;

    offer.status = status;
    offer.decidedAt = new Date();
    offer.decisionReason = reason;

    offer.placementStatusSync = {
      ...offer.placementStatusSync,
      status: 'Reverted',
      revertedAt: new Date(),
      revertedBy: new mongoose.Types.ObjectId(auth.user.id),
      revertReason: reason,
    };

    await offer.save();

    // If offer was linked to a drive application, update application status history
    if (offer.application) {
      const app = await Application.findById(offer.application);
      if (app) {
        app.status = status === 'Declined' || status === 'Revoked' ? 'Rejected' : app.status;
        app.statusHistory.push({
          status: app.status,
          roundIndex: app.currentRoundIndex,
          changedBy: new mongoose.Types.ObjectId(auth.user.id),
          reason: `Offer ${status}: ${reason}`,
          changedAt: new Date(),
        });
        await app.save();
      }
    }

    // Synchronize and revert Student placementStatus and placementDetails cache
    const syncResult = await syncStudentPlacementStatusFromOffers(offer.student);

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'REVERSE_OFFER',
      resource: 'Offer',
      resourceId: id,
      details: {
        studentId: offer.student.toString(),
        companyName: offer.companyName,
        previousStatus,
        newStatus: status,
        reason,
        resultingPlacementStatus: syncResult.placementStatus,
      },
    });

    return NextResponse.json({
      message: `Offer successfully changed to ${status}.`,
      offer,
      placementStatus: syncResult.placementStatus,
      hasQualifyingOffer: syncResult.hasQualifyingOffer,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PUT /api/offers/[id]/reversal error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
