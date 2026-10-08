import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const createFeedbackSchema = z.object({
  sessionId: z.string().trim().min(1, 'Session ID is required'),
  studentId: z.string().trim().optional(),
  rating: z.coerce.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().trim().max(1000).optional(),
});

export const feedbackQuerySchema = paginationQuerySchema.extend({
  sessionId: z.string().trim().optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type FeedbackQueryInput = z.infer<typeof feedbackQuerySchema>;
