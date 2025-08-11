import { z } from 'zod';

/**
 * Validates route params (e.g., beach id == AEMET 'codigo').
 * We accept any non-empty string; more constraints can be added if needed.
 */
export const BeachIdSchema = z.object({
  id: z.string().min(1),
});

export type BeachIdParams = z.infer<typeof BeachIdSchema>;
