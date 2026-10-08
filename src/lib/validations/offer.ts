import { z } from 'zod';
import {
  OFFER_TYPES,
  OFFER_STATUSES,
  OFFER_TIER_NAMES,
} from '@/config/collegeConfig';
import { paginationQuerySchema, nullableNumber } from './common';

export const createDriveOfferSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required'),
  role: z.string().trim().max(120).optional(),
  type: z.enum(OFFER_TYPES).default('Full-time'),
  ctcLpa: nullableNumber(z.number().min(0).max(200)).optional(),
  stipendMonthly: nullableNumber(z.number().min(0).max(500000)).optional(),
  tier: z.enum(OFFER_TIER_NAMES).optional().nullable(),
  status: z.enum(OFFER_STATUSES).default('Accepted'),
  offerDate: z.coerce.date().optional().default(() => new Date()),
  joiningDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  overrideReason: z.string().trim().max(500).optional(),
});

export const createManualOfferSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required'),
  companyName: z.string().trim().min(1, 'Company name is required').max(150),
  companyId: z.string().trim().optional(),
  role: z.string().trim().min(1, 'Role is required').max(120),
  type: z.enum(OFFER_TYPES).default('Full-time'),
  ctcLpa: nullableNumber(z.number().min(0).max(200)).optional(),
  stipendMonthly: nullableNumber(z.number().min(0).max(500000)).optional(),
  tier: z.enum(OFFER_TIER_NAMES).optional().nullable(),
  status: z.enum(OFFER_STATUSES).default('Accepted'),
  offerDate: z.coerce.date().optional().default(() => new Date()),
  joiningDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  overrideReason: z.string().trim().max(500).optional(),
});

export const reversalOfferSchema = z.object({
  status: z.enum(['Declined', 'Revoked', 'Pending']),
  reason: z.string().trim().min(3, 'A clear reason is required for offer reversal or status update').max(500),
});

export const shortlistPreviewSchema = z.object({
  targetRoundIndex: z.coerce.number().int().min(0, 'Target round index must be non-negative'),
  rollNumbers: z.array(z.string().trim().min(1)).min(1, 'At least one roll number or PRN is required'),
});

export const shortlistConfirmSchema = z.object({
  targetRoundIndex: z.coerce.number().int().min(0, 'Target round index must be non-negative'),
  shortlistedRollNumbers: z.array(z.string().trim().min(1)).min(1, 'At least one student must be shortlisted'),
  eliminateOmitted: z.boolean(),
  rejectionReason: z.string().trim().max(200).optional(),
});

export const offerQuerySchema = paginationQuerySchema.extend({
  studentId: z.string().trim().optional(),
  driveId: z.string().trim().optional(),
  status: z.enum(OFFER_STATUSES).optional(),
  type: z.enum(OFFER_TYPES).optional(),
  batch: z.coerce.number().int().optional(),
});

export type CreateDriveOfferInput = z.infer<typeof createDriveOfferSchema>;
export type CreateManualOfferInput = z.infer<typeof createManualOfferSchema>;
export type ReversalOfferInput = z.infer<typeof reversalOfferSchema>;
export type ShortlistPreviewInput = z.infer<typeof shortlistPreviewSchema>;
export type ShortlistConfirmInput = z.infer<typeof shortlistConfirmSchema>;
export type OfferQueryInput = z.infer<typeof offerQuerySchema>;
