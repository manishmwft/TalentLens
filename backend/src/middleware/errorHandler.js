import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404,
    ),
  );
}

function normalizeError(error) {
  if (error instanceof multer.MulterError) {
    const statusCode =
      error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

    return new AppError(
      error.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded recording exceeds the allowed size.'
        : `Media upload failed: ${error.message}`,
      statusCode,
      {
        code: error.code,
        field: error.field || null,
      },
    );
  }

  return error;
}

export function errorHandler(
  originalError,
  req,
  res,
  _next,
) {
  const error = normalizeError(originalError);
  const statusCode =
    error.statusCode ||
    error.status ||
    500;

  if (res.headersSent) {
    console.error(
      'Error occurred after response headers were sent:',
      error,
    );
    return;
  }

  const payload = {
    success: false,
    message:
      statusCode === 500
        ? 'Internal server error'
        : error.message,
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    statusCode === 500
  ) {
    payload.stack = error.stack;
  }

  console.error('Request failed', {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: error.message,
    code: error.code || '',
    stack:
      process.env.NODE_ENV !== 'production'
        ? error.stack
        : undefined,
  });

  res.status(statusCode).json(payload);
}
