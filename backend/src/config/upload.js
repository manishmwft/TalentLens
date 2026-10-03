import path from 'path';
import multer from 'multer';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function fileFilter(_req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const validExtension = extension === '.pdf' || extension === '.docx';
  const validMime = allowedMimeTypes.has(file.mimetype);

  if (!validExtension || !validMime) {
    callback(new AppError('Only PDF and DOCX resume files are allowed', 400));
    return;
  }

  callback(null, true);
}

// Vercel/serverless-safe: keep the incoming resume in memory. Controllers upload
// the buffer to Vercel Blob instead of depending on an ephemeral local filesystem.
export const uploadResumes = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: env.maxFilesPerUpload,
  },
});
