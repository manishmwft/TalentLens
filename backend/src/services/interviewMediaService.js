import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { AppError } from '../utils/AppError.js';

const mediaRoot = path.join(process.cwd(), 'uploads', 'interviews');

function safe(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'unknown';
}

export async function checksumFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function removeMediaFiles(files = []) {
  await Promise.all(files.filter(Boolean).map(async (file) => {
    try { await fsp.unlink(file.path || file); }
    catch (error) { if (error.code !== 'ENOENT') console.error('Media cleanup failed:', error); }
  }));
}

export async function finalizeMediaFile({ file, organizationId, interviewId, attemptId, questionId, submissionId, durationSeconds }) {
  if (!file) return null;
  if (!file.size) throw new AppError(`${file.fieldname} recording is empty`, 400);

  const extension = path.extname(file.filename || file.originalname || '') || '.bin';
  const directory = path.join(mediaRoot, safe(organizationId), safe(interviewId), safe(attemptId), safe(questionId));
  await fsp.mkdir(directory, { recursive: true });
  const finalPath = path.join(directory, `${file.fieldname}-${safe(submissionId)}${extension}`);
  const checksum = await checksumFile(file.path);
  await fsp.rename(file.path, finalPath);
  const now = new Date();

  return {
    filePath: path.relative(process.cwd(), finalPath).replace(/\\/g, '/'),
    storageKey: path.relative(mediaRoot, finalPath).replace(/\\/g, '/'),
    storageProvider: 'local',
    mimeType: file.mimetype,
    sizeBytes: file.size,
    durationSeconds: Number(durationSeconds || 0),
    recordedAt: now,
    uploadedAt: now,
    verifiedAt: now,
    checksum,
  };
}

export function resolveStoredMedia(filePath) {
  const absolute = path.resolve(process.cwd(), String(filePath || ''));
  const allowedRoot = path.resolve(mediaRoot);
  if (!absolute.startsWith(`${allowedRoot}${path.sep}`)) throw new AppError('Invalid media path', 400);
  return absolute;
}

export async function streamMedia(req, res, media) {
  const absolute = resolveStoredMedia(media?.filePath);
  let stats;
  try { stats = await fsp.stat(absolute); }
  catch { throw new AppError('Media file not found', 404); }

  const total = stats.size;
  const range = req.headers.range;
  res.setHeader('Content-Type', media.mimeType || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=300');

  if (!range) {
    res.setHeader('Content-Length', total);
    fs.createReadStream(absolute).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) throw new AppError('Invalid media range', 416);
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : total - 1;
  if (start > end || end >= total) throw new AppError('Requested media range is not satisfiable', 416);

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  res.setHeader('Content-Length', end - start + 1);
  fs.createReadStream(absolute, { start, end }).pipe(res);
}
