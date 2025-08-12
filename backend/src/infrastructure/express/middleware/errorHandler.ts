import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger'; // Adjust the path as needed

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn({
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack,
      path: req.path,
    });

    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
