import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const createSessionSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
  date: z.coerce.date({ message: 'Invalid session date format' }),
  trainer: z.string().trim().min(2, 'Trainer name is required').max(100),
  description: z.string().trim().optional(),
});

export const updateSessionSchema = createSessionSchema.partial();

export const sessionQuerySchema = paginationQuerySchema.extend({
  all: z.enum(['true', 'false']).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type SessionQueryInput = z.infer<typeof sessionQuerySchema>;
