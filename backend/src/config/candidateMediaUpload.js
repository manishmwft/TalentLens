import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const temporaryRoot = process.env.VERCEL
  ? path.join('/tmp', 'talentlens', 'interviews', 'temp')
  : path.join(
      process.cwd(),
      'uploads',
      'interviews',
      'temp',
    );

fs.mkdirSync(temporaryRoot, { recursive: true });

function safeSegment(value = 'unknown') {
  return (
    String(value)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 100) || 'unknown'
  );
}

function extensionForMime(mimeType) {
  const extensions = {
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/mpeg': '.mp3',
    'video/webm': '.webm',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
  };

  return extensions[mimeType] || '.bin';
}

const storage = multer.diskStorage({
  destination(req, _file, callback) {
    try {
      const destination = path.join(
        temporaryRoot,
        safeSegment(req.candidateAccount?._id),
        safeSegment(req.params.interviewId),
        safeSegment(req.params.questionId),
        safeSegment(
          req.headers['x-submission-id'] || 'pending',
        ),
      );

      fs.mkdirSync(destination, {
        recursive: true,
      });

      callback(null, destination);
    } catch (error) {
      callback(error);
    }
  },

  filename(_req, file, callback) {
    callback(
      null,
      `${file.fieldname}-${Date.now()}${extensionForMime(
        file.mimetype,
      )}`,
    );
  },
});

const audioTypes = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
]);

const videoTypes = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
]);

function fileFilter(_req, file, callback) {
  const accepted =
    file.fieldname === 'audio'
      ? audioTypes.has(file.mimetype)
      : file.fieldname === 'video'
        ? videoTypes.has(file.mimetype)
        : false;

  if (!accepted) {
    callback(
      new AppError(
        `Unsupported ${file.fieldname || 'media'} type: ${
          file.mimetype || 'unknown'
        }`,
        400,
      ),
    );
    return;
  }

  callback(null, true);
}

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    files: 2,
    fields: 12,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
    fileSize:
      Number(
        process.env.INTERVIEW_MEDIA_FILE_MAX_MB || 150,
      ) *
      1024 *
      1024,
  },
}).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

async function removeUploadedFiles(req) {
  const files = [
    ...(req.files?.audio || []),
    ...(req.files?.video || []),
  ];

  await Promise.all(
    files.map(async (file) => {
      try {
        await fsp.unlink(file.path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(
            'Unable to clean failed upload:',
            error,
          );
        }
      }
    }),
  );
}

function normalizeMulterError(error) {
  if (!(error instanceof multer.MulterError)) {
    return error;
  }

  const messages = {
    LIMIT_FILE_SIZE:
      'The recording is larger than the allowed per-file limit.',
    LIMIT_FILE_COUNT:
      'Too many media files were uploaded.',
    LIMIT_UNEXPECTED_FILE:
      'The upload contains an unexpected media field.',
    LIMIT_FIELD_VALUE:
      'An upload metadata field is too large.',
    LIMIT_FIELD_COUNT:
      'Too many upload metadata fields were sent.',
    LIMIT_PART_COUNT:
      'The multipart upload contains too many parts.',
  };

  return new AppError(
    messages[error.code] ||
      `Media upload failed: ${error.message}`,
    error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
    {
      code: error.code,
      field: error.field || null,
    },
  );
}

export function uploadCandidateAnswerMedia(
  req,
  res,
  next,
) {
  const startedAt = Date.now();

  req.on('aborted', () => {
    console.error('Candidate media request aborted', {
      interviewId: req.params.interviewId,
      questionId: req.params.questionId,
      submissionId:
        req.headers['x-submission-id'] || '',
      elapsedMs: Date.now() - startedAt,
    });
  });

  multerUpload(req, res, async (error) => {
    if (!error) {
      next();
      return;
    }

    await removeUploadedFiles(req);

    const normalized = normalizeMulterError(error);

    console.error('Candidate media upload rejected', {
      interviewId: req.params.interviewId,
      questionId: req.params.questionId,
      submissionId:
        req.headers['x-submission-id'] || '',
      code: normalized.code || error.code || '',
      message: normalized.message,
      elapsedMs: Date.now() - startedAt,
    });

    next(normalized);
  });
}
