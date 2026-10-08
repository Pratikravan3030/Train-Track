import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const createStudentSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
    rollNumber: z.string().trim().min(2, 'Roll number / PRN must be at least 2 characters').max(30),
    department: z.string().trim().optional(),
    branch: z.string().trim().optional(),
    year: z.string().trim().min(1, 'Academic year is required').max(50),
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
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().optional(),
});

export const studentQuerySchema = paginationQuerySchema.extend({
  branch: z.string().trim().optional(),
  year: z.string().trim().optional(),
  all: z.enum(['true', 'false']).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
