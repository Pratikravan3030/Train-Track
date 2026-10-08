import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Safely converts empty strings, whitespace, undefined, or null to null BEFORE validation.
 * "0" and 0 strictly stay 0.
 */
export const nullableNumberPreprocessor = (val: unknown): number | null | undefined => {
  if (val === undefined) {
    return undefined;
  }
  if (val === '' || val === null) {
    return null;
  }
  if (typeof val === 'number') {
    return Number.isNaN(val) ? null : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return Number.isNaN(num) ? NaN : num;
  }
  return NaN;
};

export const nullableNumber = (numberSchema: z.ZodNumber) =>
  z.preprocess((val) => (val === undefined ? null : nullableNumberPreprocessor(val)), numberSchema.nullable());
