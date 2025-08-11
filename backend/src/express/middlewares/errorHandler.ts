import { Request, Response, NextFunction } from 'express';
import { BeachNotFoundError } from '../../domain/use-cases/GetBeachById';

/**
 * Central error handler that keeps response shapes consistent.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Minimal discriminated handling; expand as needed.
  if (err instanceof BeachNotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  // Generic fallback
  const message = err instanceof Error ? err.message : 'Unexpected error';
  // Log server-side
  // eslint-disable-next-line no-console
  console.error('[ERROR]', err);
  return res.status(500).json({ error: message });
}
