import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function uploadErrorHandler(error, _req, _res, next) {
  if (!(error instanceof multer.MulterError)) {
    next(error);
    return;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    next(new AppError(`Each resume must be ${env.maxFileSizeMb} MB or smaller`, 400));
    return;
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    next(new AppError(`Upload a maximum of ${env.maxFilesPerUpload} resumes`, 400));
    return;
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    next(new AppError('Resume files must use the field name "resumes"', 400));
    return;
  }

  next(new AppError(error.message, 400));
}
