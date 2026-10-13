import { z } from 'zod';

export const chatRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(4000),
  title: z.string().trim().max(80).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const createSessionSchema = z.object({
  title: z.string().trim().max(80).optional(),
});

export type CreateSessionRequest = z.infer<typeof createSessionSchema>;
