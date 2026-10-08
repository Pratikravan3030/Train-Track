import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const hrContactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(100),
  email: z.string().trim().email('Valid contact email is required').toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  designation: z.string().trim().max(100).optional(),
});

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(150),
  sector: z.string().trim().min(1, 'Sector is required').max(100),
  website: z.string().trim().url('Invalid website URL').optional().or(z.literal('')),
  hrContacts: z.array(hrContactSchema).optional().default([]),
  preSystemHistory: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  sector: z.string().trim().min(1).max(100).optional(),
  website: z.string().trim().url('Invalid website URL').optional().or(z.literal('')),
  hrContacts: z.array(hrContactSchema).optional(),
  preSystemHistory: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
  isArchived: z.boolean().optional(),
});

export const companyQuerySchema = paginationQuerySchema.extend({
  sector: z.string().trim().optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CompanyQueryInput = z.infer<typeof companyQuerySchema>;
