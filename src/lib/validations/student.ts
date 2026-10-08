import { z } from 'zod';
import { paginationQuerySchema } from './common';
import {
  PLACEMENT_STATUSES,
  DEFAULT_PASSOUT_YEAR,
} from '@/config/collegeConfig';

export const placementDetailsSchema = z.object({
  companyName: z.string().trim().max(150).optional(),
  packageLPA: z.coerce.number().min(0).max(200).optional(),
  placedDate: z.coerce.date().optional(),
  reasonForStatusChange: z.string().trim().max(500).optional(),
});

export const createStudentSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
    rollNumber: z.string().trim().min(2, 'Roll number / PRN must be at least 2 characters').max(30),
    department: z.string().trim().optional(),
    branch: z.string().trim().optional(),
    year: z.string().trim().min(1, 'Academic year is required').max(50),
    passoutYear: z.coerce
      .number()
      .int('Passout year must be an integer')
      .min(2000, 'Passout year must be 2000 or later')
      .max(2100, 'Passout year is out of valid range')
      .default(DEFAULT_PASSOUT_YEAR),
    placementStatus: z.enum(PLACEMENT_STATUSES).optional().default('Not Placed'),
    placementDetails: placementDetailsSchema.optional(),
    cgpa: z.coerce.number().min(0).max(10).optional(),
    backlogs: z.coerce.number().int().min(0).optional().default(0),
    resumeUrl: z.string().trim().optional(),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    phone: z.string().trim().optional(),
  })
  .refine(
    (data) => Boolean((data.department && data.department.trim()) || (data.branch && data.branch.trim())),
    {
      message: 'Department is required',
      path: ['department'],
    }
  );

export const updateStudentSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  rollNumber: z.string().trim().min(2).max(30).optional(),
  department: z.string().trim().optional(),
  branch: z.string().trim().optional(),
  year: z.string().trim().min(1).max(50).optional(),
  passoutYear: z.coerce.number().int().min(2000).max(2100).optional(),
  placementStatus: z.enum(PLACEMENT_STATUSES).optional(),
  placementDetails: placementDetailsSchema.optional(),
  statusChangeReason: z.string().trim().min(1).max(500).optional(), // Required when de-listing from 'Placed'
  cgpa: z.coerce.number().min(0).max(10).optional(),
  backlogs: z.coerce.number().int().min(0).optional(),
  resumeUrl: z.string().trim().optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().optional(),
});

export const studentQuerySchema = paginationQuerySchema.extend({
  department: z.string().trim().optional(),
  branch: z.string().trim().optional(),
  year: z.string().trim().optional(),
  passoutYear: z.coerce.number().int().optional(),
  batch: z.coerce.number().int().optional(), // Alias for passoutYear
  placementStatus: z.enum(PLACEMENT_STATUSES).optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  maxBacklogs: z.coerce.number().int().min(0).optional(),
  all: z.enum(['true', 'false']).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
