import mongoose from 'mongoose';
import Offer, { IOffer } from '@/models/Offer';
import Student from '@/models/Student';
import { PLACEMENT_POLICY_CONFIG } from '@/config/collegeConfig';

/**
 * Recalculates and synchronizes Student.placementStatus and Student.placementDetails
 * from the student's accepted offers.
 *
 * Rules:
 * - Offer is the single source of truth for placements.
 * - Only offer types in PLACEMENT_POLICY_CONFIG.rules.placementStatOfferTypes (default: ['Full-time', 'PPO'])
 *   qualify to mark the student as 'Placed'.
 * - Student.placementDetails caches the highest accepted CTC qualifying offer.
 * - Reversal: When an accepted offer is revoked/declined, if no other qualifying accepted offer exists,
 *   the student is reverted to 'Not Placed' and placementDetails is cleared.
 */
export async function syncStudentPlacementStatusFromOffers(
  studentId: string | mongoose.Types.ObjectId
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

  if (qualifyingAcceptedOffers.length > 0) {
    const bestOffer = qualifyingAcceptedOffers[0];
    student.placementStatus = 'Placed';
    student.placementDetails = {
      companyName: bestOffer.companyName,
      packageLPA: bestOffer.ctcLpa != null ? bestOffer.ctcLpa : undefined,
      placedDate: bestOffer.offerDate || new Date(),
    };
    await student.save();

    return {
      placementStatus: 'Placed',
      hasQualifyingOffer: true,
      bestOffer: bestOffer as unknown as IOffer,
    };
  }

  // No qualifying accepted offers remain
  // Revert status from Placed to Not Placed if needed
  if (student.placementStatus === 'Placed') {
    student.placementStatus = 'Not Placed';
    student.set('placementDetails', undefined);
    await student.save();
  }

  return {
    placementStatus: student.placementStatus,
    hasQualifyingOffer: false,
  };
}
