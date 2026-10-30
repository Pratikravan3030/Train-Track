import { z } from 'zod';
import { paginationQuerySchema, nullableNumber, nullableNumberPreprocessor } from './common';
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

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

export const certificationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  issuer: z.string().trim().min(1, 'Issuer is required'),
  issueDate: z.string().trim().optional(),
  url: z.string().trim().optional().or(z.literal('')),
});

export const projectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
  techStack: z.array(z.string().trim()).optional().default([]),
  githubUrl: z.string().trim().optional().or(z.literal('')),
  liveUrl: z.string().trim().optional().or(z.literal('')),
});

export const internshipSchema = z.object({
  company: z.string().trim().min(1, 'Company is required'),
  role: z.string().trim().min(1, 'Role is required'),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export const socialLinksSchema = z.object({
  github: z.string().trim().optional().or(z.literal('')),
  linkedin: z.string().trim().optional().or(z.literal('')),
  portfolio: z.string().trim().optional().or(z.literal('')),
});

export const backlogHistorySchema = z.object({
  active: z.number().int().min(0).default(0),
  dead: z.number().int().min(0).default(0),
  cleared: z.number().int().min(0).default(0),
});

export const createStudentSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
    rollNumber: z.string().trim().min(2, 'Roll number / PRN must be at least 2 characters').max(30),
    department: z.string().trim().optional(),
    branch: z.string().trim().optional(),
    year: z.string().trim().min(1, 'Academic year is required').max(50),
    passoutYear: z.preprocess(
      (val) =>
        val === '' || val === null || val === undefined
          ? DEFAULT_PASSOUT_YEAR
          : nullableNumberPreprocessor(val),
      z
        .number()
        .int('Passout year must be an integer')
        .min(2000, 'Passout year must be 2000 or later')
        .max(2100, 'Passout year is out of valid range')
        .default(DEFAULT_PASSOUT_YEAR)
    ),
    placementStatus: z.enum(PLACEMENT_STATUSES).optional().default('Not Placed'),
    placementDetails: placementDetailsSchema.optional(),
    cgpa: nullableNumber(z.number().min(0).max(10)).optional(),
    backlogs: nullableNumber(z.number().int().min(0)).optional(),
    tenthPercentage: nullableNumber(z.number().min(0).max(100)).optional(),
    twelfthOrDiplomaPercentage: nullableNumber(z.number().min(0).max(100)).optional(),
    gender: z.enum(GENDERS).optional(),
    dateOfBirth: z.coerce.date().optional().nullable(),
    division: z.string().trim().max(10).optional(),
    semesterSgpa: z.array(z.number().min(0).max(10)).optional().default([]),
    backlogHistory: backlogHistorySchema.optional(),
    skills: z.array(z.string().trim()).optional().default([]),
    certifications: z.array(certificationSchema).optional().default([]),
    projects: z.array(projectSchema).optional().default([]),
    internships: z.array(internshipSchema).optional().default([]),
    socialLinks: socialLinksSchema.optional(),
    photoUrl: z.string().trim().optional(),
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
  passoutYear: z.preprocess(
    nullableNumberPreprocessor,
    z.number().int().min(2000).max(2100).optional().nullable()
  ),
  placementStatus: z.enum(PLACEMENT_STATUSES).optional(),
  placementDetails: placementDetailsSchema.optional(),
  statusChangeReason: z.string().trim().min(1).max(500).optional(), // Required when de-listing from 'Placed'
  cgpa: nullableNumber(z.number().min(0).max(10)).optional(),
  backlogs: nullableNumber(z.number().int().min(0)).optional(),
  tenthPercentage: nullableNumber(z.number().min(0).max(100)).optional(),
  twelfthOrDiplomaPercentage: nullableNumber(z.number().min(0).max(100)).optional(),
  gender: z.enum(GENDERS).optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  division: z.string().trim().max(10).optional(),
  semesterSgpa: z.array(z.number().min(0).max(10)).optional(),
  backlogHistory: backlogHistorySchema.optional(),
  skills: z.array(z.string().trim()).optional(),
  certifications: z.array(certificationSchema).optional(),
  projects: z.array(projectSchema).optional(),
  internships: z.array(internshipSchema).optional(),
  socialLinks: socialLinksSchema.optional(),
  photoUrl: z.string().trim().optional(),
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
