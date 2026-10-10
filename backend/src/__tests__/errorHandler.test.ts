import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../infrastructure/express/middlewares/errorHandler';

describe('errorHandler', () => {
  it('leaves alone a response the request timeout already answered', () => {
    // Writing again would throw, and Express closes the connection on that.
    const res = { headersSent: true, status: vi.fn() } as unknown as Response;
    errorHandler(new Error('late'), {} as Request, res, vi.fn());
    expect(res.status).not.toHaveBeenCalled();
  });
});
