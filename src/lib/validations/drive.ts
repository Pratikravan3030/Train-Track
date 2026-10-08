import { z } from 'zod';
import {
  DRIVE_TYPES,
  DRIVE_MODES,
  DRIVE_STATUSES,
  OFFER_TIER_NAMES,
  DEPARTMENT_CODES,
  DepartmentCode,
} from '@/config/collegeConfig';
import { paginationQuerySchema, nullableNumber } from './common';

export const driveEligibilityRulesSchema = z.object({
  minCgpa: nullableNumber(z.number().min(0).max(10)).optional(),
  maxBacklogs: nullableNumber(z.number().int().min(0)).optional(),
  allowedDepartments: z
    .array(z.enum(DEPARTMENT_CODES as unknown as [DepartmentCode, ...DepartmentCode[]]))
    .optional()
    .default([]),
  allowedBatches: z.array(z.coerce.number().int().min(2000).max(2100)).optional().default([]),
  minTenthPercentage: nullableNumber(z.number().min(0).max(100)).optional(),
  minTwelfthOrDiplomaPercentage: nullableNumber(z.number().min(0).max(100)).optional(),
});

export const createDriveSchema = z
  .object({
    company: z.string().trim().min(1, 'Company ID is required'),
    role: z.string().trim().min(1, 'Job role is required').max(120),
    type: z.enum(DRIVE_TYPES),
    jd: z.string().trim().min(1, 'Job description is required'),
    ctcLpa: nullableNumber(z.number().min(0).max(200)).optional(),
    stipendMonthly: nullableNumber(z.number().min(0).max(500000)).optional(),
    tier: z.enum(OFFER_TIER_NAMES).optional().nullable(),
    location: z.string().trim().min(1, 'Location is required'),
    mode: z.enum(DRIVE_MODES).default('On-Campus'),
    driveDate: z.coerce.date(),
    registrationDeadline: z.coerce.date(),
    bondNotes: z.string().trim().max(500).optional(),
    selectionRounds: z
      .array(z.string().trim().min(1))
      .min(1, 'At least one round is required')
      .default(['Online Assessment', 'Technical Interview', 'HR Interview']),
    eligibilityRules: driveEligibilityRulesSchema.optional(),
    status: z.enum(DRIVE_STATUSES).default('Draft'),
  })
  .refine(
    (data) => new Date(data.registrationDeadline).getTime() < new Date(data.driveDate).getTime(),
    {
      message: 'Registration deadline must be strictly before the drive date.',
      path: ['registrationDeadline'],
    }
  );

export const updateDriveSchema = z
  .object({
    company: z.string().trim().min(1).optional(),
    role: z.string().trim().min(1).max(120).optional(),
    type: z.enum(DRIVE_TYPES).optional(),
    jd: z.string().trim().min(1).optional(),
    ctcLpa: nullableNumber(z.number().min(0).max(200)).optional(),
    stipendMonthly: nullableNumber(z.number().min(0).max(500000)).optional(),
    tier: z.enum(OFFER_TIER_NAMES).optional().nullable(),
    location: z.string().trim().min(1).optional(),
    mode: z.enum(DRIVE_MODES).optional(),
    driveDate: z.coerce.date().optional(),
    registrationDeadline: z.coerce.date().optional(),
    bondNotes: z.string().trim().max(500).optional(),
    selectionRounds: z.array(z.string().trim().min(1)).min(1).optional(),
    eligibilityRules: driveEligibilityRulesSchema.optional(),
    status: z.enum(DRIVE_STATUSES).optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.registrationDeadline && data.driveDate) {
        return (
          new Date(data.registrationDeadline).getTime() < new Date(data.driveDate).getTime()
        );
      }
      return true;
    },
    {
      message: 'Registration deadline must be strictly before the drive date.',
      path: ['registrationDeadline'],
    }
  );

export const driveQuerySchema = paginationQuerySchema.extend({
  batch: z.coerce.number().int().optional(),
  companyId: z.string().trim().optional(),
  status: z.enum(DRIVE_STATUSES).optional(),
  type: z.enum(DRIVE_TYPES).optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
});

export const registerDriveApplicationSchema = z
  .object({
    studentId: z.string().trim().optional(),
    studentIds: z.array(z.string().trim()).optional(),
    lateRegistrationReason: z.string().trim().max(500).optional(),
    overrideReason: z.string().trim().max(500).optional(),
  })
  .refine((data) => Boolean(data.studentId || (data.studentIds && data.studentIds.length > 0)), {
    message: 'Either studentId or studentIds must be provided.',
    path: ['studentId'],
  });

export type CreateDriveInput = z.infer<typeof createDriveSchema>;
export type UpdateDriveInput = z.infer<typeof updateDriveSchema>;
export type DriveQueryInput = z.infer<typeof driveQuerySchema>;
export type RegisterDriveApplicationInput = z.infer<typeof registerDriveApplicationSchema>;
