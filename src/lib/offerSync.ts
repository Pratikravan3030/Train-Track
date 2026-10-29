import mongoose from 'mongoose';
import Offer, { IOffer } from '@/models/Offer';
import Student from '@/models/Student';
import { PLACEMENT_POLICY_CONFIG } from '@/config/collegeConfig';

// Statuses that cannot be overwritten by automatic offer synchronization
export const NON_OVERWRITABLE_STATUSES = [
  'Opted Out',
  'Higher Studies',
  'Entrepreneurship',
] as const;

/**
 * Recalculates and synchronizes Student.placementStatus and Student.placementDetails
 * from the student's accepted offers.
 *
 * Rules:
 * - Offer-to-placement sync only moves a student between 'Placed' and 'Not Placed'.
 * - It NEVER overwrites 'Opted Out', 'Higher Studies', or 'Entrepreneurship'.
 * - Only offer types in PLACEMENT_POLICY_CONFIG.rules.placementStatOfferTypes (default: ['Full-time', 'PPO'])
 *   qualify to mark the student as 'Placed'.
 * - Student.placementDetails caches the highest accepted CTC qualifying offer.
 * - Leaving 'Placed' strictly requires a reason (recorded in placementDetails.reasonForStatusChange).
 */
export async function syncStudentPlacementStatusFromOffers(
  studentId: string | mongoose.Types.ObjectId,
  options?: {
    reason?: string;
    userId?: string | mongoose.Types.ObjectId;
  }
): Promise<{
  placementStatus: string;
  hasQualifyingOffer: boolean;
  bestOffer?: IOffer;
}> {
  const qualifyingTypes = [...PLACEMENT_POLICY_CONFIG.rules.placementStatOfferTypes];

  // Find all accepted qualifying offers for this student
  const qualifyingAcceptedOffers = await Offer.find({
    student: studentId,
    status: 'Accepted',
    type: { $in: qualifyingTypes },
  })
    .sort({ ctcLpa: -1, offerDate: -1 })
    .lean();

  const student = await Student.findById(studentId);
  if (!student) {
    throw new Error(`Student ${studentId} not found for placement sync.`);
  }

  // Guard: Never overwrite Opted Out, Higher Studies, or Entrepreneurship
  if ((NON_OVERWRITABLE_STATUSES as readonly string[]).includes(student.placementStatus)) {
    return {
      placementStatus: student.placementStatus,
      hasQualifyingOffer: qualifyingAcceptedOffers.length > 0,
      bestOffer: (qualifyingAcceptedOffers[0] as unknown as IOffer) || undefined,
    };
  }

  if (qualifyingAcceptedOffers.length > 0) {
    const bestOffer = qualifyingAcceptedOffers[0];
    student.placementStatus = 'Placed';
    student.placementDetails = {
      companyName: bestOffer.companyName,
      packageLPA: bestOffer.ctcLpa != null ? bestOffer.ctcLpa : undefined,
      placedDate: bestOffer.offerDate || new Date(),
      reasonForStatusChange: options?.reason,
    };
    await student.save();

    return {
      placementStatus: 'Placed',
      hasQualifyingOffer: true,
      bestOffer: bestOffer as unknown as IOffer,
    };
  }

  // No qualifying accepted offers remain.
  // Revert status from Placed to Not Placed if needed
  if (student.placementStatus === 'Placed') {
    const reason = options?.reason?.trim() || 'Accepted offer was declined, revoked, or deleted';
    student.placementStatus = 'Not Placed';
    student.placementDetails = {
      reasonForStatusChange: reason,
    };
    await student.save();
  }

  return {
    placementStatus: student.placementStatus,
    hasQualifyingOffer: false,
  };
}
