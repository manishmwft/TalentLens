import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// pdf-parse@1.1.1's package entry runs its bundled test when loaded from ESM/Node 22.
// Load the parser implementation directly so app startup never executes that test file.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function resolveFileBuffer(file) {
  if (Buffer.isBuffer(file?.buffer)) return file.buffer;

  const location = String(file?.path || '').trim();
  if (!location) throw new Error('Resume file data is unavailable');

  if (/^https?:\/\//i.test(location)) {
    const response = await fetch(location);
    if (!response.ok) {
      throw new Error(`Unable to read resume from Blob storage (${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return fs.readFile(location);
}

export async function extractResumeText(file) {
  const extension = path.extname(file.originalname || file.filename || '').toLowerCase();
  const buffer = await resolveFileBuffer(file);
  let rawText;

  if (extension === '.pdf') {
    const result = await pdfParse(buffer);
    rawText = result.text || '';
  } else if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || '';
  } else {
    throw new Error('Unsupported resume format');
  }

  const extractedText = cleanText(rawText);
  if (!extractedText) throw new Error('No readable text was found in this resume');
  return extractedText;
}
