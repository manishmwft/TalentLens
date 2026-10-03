import PDFDocument from 'pdfkit';
import { resolveCandidateContact } from '../utils/contactExtractor.js';

const PAGE = {
  left: 48,
  right: 547,
  width: 499,
  top: 48,
  bottom: 775,
};

function cleanText(value, fallback = '') {
  const normalized = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\uFFFD/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized || fallback;
}

function cleanList(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => cleanText(item)).filter(Boolean);
}

function labelize(value = '') {
  return cleanText(value, 'Not available')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ensureSpace(doc, required = 60) {
  if (doc.y + required > PAGE.bottom) doc.addPage();
}

function drawSectionHeading(doc, title, options = {}) {
  const { topGap = 14 } = options;
  ensureSpace(doc, 40);
  doc.moveDown(topGap / 12);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#172033')
    .text(cleanText(title), PAGE.left, doc.y, { width: PAGE.width });
  doc.moveDown(0.35);
}

function drawDivider(doc) {
  ensureSpace(doc, 18);
  const y = doc.y + 5;
  doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
  doc.y = y + 10;
}

function drawBulletList(doc, items) {
  const values = cleanList(items);
  const rows = values.length ? values : ['None identified'];
  const bulletX = PAGE.left + 2;
  const textX = PAGE.left + 18;
  const textWidth = PAGE.width - 18;

  for (const item of rows) {
    const itemText = cleanText(item, 'None identified');
    const textHeight = doc
      .font('Helvetica')
      .fontSize(9.5)
      .heightOfString(itemText, {
        width: textWidth,
        lineGap: 2,
      });

    ensureSpace(doc, Math.max(26, textHeight + 10));
    const rowY = doc.y;

    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#4F46E5')
      .text('-', bulletX, rowY, {
        width: 10,
        lineBreak: false,
      });

    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#334155')
      .text(itemText, textX, rowY, {
        width: textWidth,
        lineGap: 2,
      });

    doc.y = rowY + textHeight + 7;
  }
}

function drawMetaGrid(doc, rows) {
  const gap = 14;
  const columnWidth = (PAGE.width - gap) / 2;
  const startY = doc.y;
  let tallest = 0;

  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE.left + column * (columnWidth + gap);
    const y = startY + row * 47;

    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(label.toUpperCase(), x, y, {
      width: columnWidth,
      characterSpacing: 0.5,
    });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#172033').text(cleanText(value, 'Not available'), x, y + 14, {
      width: columnWidth,
      height: 25,
      ellipsis: true,
    });
    tallest = Math.max(tallest, y + 39);
  });

  doc.y = tallest + 2;
}

function drawCandidate(doc, candidate, rank) {
  const analysis = candidate.analysis || null;
  ensureSpace(doc, 155);

  const headerY = doc.y;
  doc.roundedRect(PAGE.left, headerY, PAGE.width, 58, 8).fill('#EEF2FF');

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#3730A3')
    .text(`${rank}. ${cleanText(analysis?.candidateName, candidate.originalFileName)}`, PAGE.left + 14, headerY + 12, {
      width: 345,
      ellipsis: true,
    });

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#6366F1')
    .text(`File: ${cleanText(candidate.originalFileName, 'Unknown file')}`, PAGE.left + 14, headerY + 34, {
      width: 345,
      ellipsis: true,
    });

  const score = analysis && candidate.analysisStatus === 'completed'
    ? `${Number(analysis.matchScore || 0)}/100`
    : labelize(candidate.analysisStatus);

  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor('#3730A3')
    .text(score, PAGE.right - 115, headerY + 18, { width: 100, align: 'right' });

  doc.y = headerY + 72;

  if (!analysis || candidate.analysisStatus !== 'completed') {
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#991B1B')
      .text(`Analysis status: ${labelize(candidate.analysisStatus)}. ${cleanText(candidate.analysisError)}`, PAGE.left, doc.y, {
        width: PAGE.width,
        lineGap: 2,
      });
    doc.moveDown(1);
    drawDivider(doc);
    return;
  }

  const contact = resolveCandidateContact(candidate);

  ensureSpace(doc, 110);
  drawMetaGrid(doc, [
    ['Current role', analysis.currentRole],
    ['Recommendation', labelize(analysis.recommendation)],
    ['Experience', `${Number(analysis.totalExperienceYears || 0)} years`],
    ['Email', contact.email],
    ['Phone', contact.phone],
    ['AI model', candidate.aiModel || candidate.aiProvider],
  ]);

  drawSectionHeading(doc, 'AI summary');
  doc
    .font('Helvetica')
    .fontSize(9.7)
    .fillColor('#334155')
    .text(cleanText(analysis.summary, 'No summary generated.'), PAGE.left, doc.y, {
      width: PAGE.width,
      lineGap: 3,
      paragraphGap: 4,
    });

  drawSectionHeading(doc, 'Matched skills');
  drawBulletList(doc, analysis.matchedSkills);

  drawSectionHeading(doc, 'Missing skills');
  drawBulletList(doc, analysis.missingSkills);

  drawSectionHeading(doc, 'Strengths');
  drawBulletList(doc, analysis.strengths);

  drawSectionHeading(doc, 'Concerns');
  drawBulletList(doc, analysis.concerns);

  drawSectionHeading(doc, 'Education');
  drawBulletList(doc, analysis.education);
  doc.moveDown(0.7);
  drawDivider(doc);
}

function drawDocumentHeader(doc, title) {
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#4F46E5')
    .text('RESUMEIQ', PAGE.left, 26, { width: 120 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94A3B8')
    .text(cleanText(title), PAGE.left + 120, 27, { width: PAGE.width - 120, align: 'right' });
}

export function createScreeningPdf({ screening, candidates, recruiter }) {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: PAGE.top, right: 48, bottom: 67, left: PAGE.left },
    info: {
      Title: 'ResumeIQ Screening Report',
      Author: 'ResumeIQ',
      Subject: 'AI resume screening results',
    },
  });

  doc.on('pageAdded', () => drawDocumentHeader(doc, 'AI Resume Screening Report'));
  drawDocumentHeader(doc, 'AI Resume Screening Report');

  doc.font('Helvetica-Bold').fontSize(25).fillColor('#111827').text('AI Resume Screening Report');
  doc.moveDown(0.35);
  doc.font('Helvetica').fontSize(9.5).fillColor('#64748B');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`);
  doc.text(`Recruiter: ${cleanText(recruiter?.name, recruiter?.email || 'Not available')}`);
  doc.text(`Screening ID: ${screening._id}`);
  doc.text(`Created: ${new Date(screening.createdAt).toLocaleString('en-IN')}`);

  doc.moveDown(1.1);
  const summaryY = doc.y;
  doc.roundedRect(PAGE.left, summaryY, PAGE.width, 82, 9).fill('#F8FAFC');

  const summary = [
    ['Candidates', screening.totalCandidates],
    ['Parsed', screening.parsedCandidates],
    ['AI analyzed', screening.analyzedCandidates || 0],
    ['AI failed', screening.failedAnalysisCandidates || 0],
  ];

  const statWidth = PAGE.width / summary.length;
  summary.forEach(([label, value], index) => {
    const x = PAGE.left + index * statWidth;
    if (index > 0) {
      doc.moveTo(x, summaryY + 16).lineTo(x, summaryY + 66).strokeColor('#E2E8F0').stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(label.toUpperCase(), x + 14, summaryY + 18, {
      width: statWidth - 28,
      align: 'center',
    });
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#111827').text(String(value), x + 14, summaryY + 39, {
      width: statWidth - 28,
      align: 'center',
    });
  });

  doc.y = summaryY + 98;
  drawSectionHeading(doc, 'Job description', { topGap: 0 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(cleanText(screening.jobDescription), PAGE.left, doc.y, {
    width: PAGE.width,
    lineGap: 3,
    paragraphGap: 5,
  });

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('Ranked candidates');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Candidates are ordered by AI match score.');
  doc.moveDown(1);

  candidates.forEach((candidate, index) => drawCandidate(doc, candidate, index + 1));

  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#94A3B8')
      .text(`ResumeIQ  |  Page ${pageIndex + 1} of ${range.count}`, PAGE.left, 806, {
        width: PAGE.width,
        align: 'center',
        lineBreak: false,
      });
  }

  return doc;
}

function csvCell(value) {
  const stringValue = cleanText(value)
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replaceAll('"', '""');
  return `"${stringValue}"`;
}

function csvDocument(headers, rows) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function createCandidatesCsv(candidates) {
  const headers = [
    'Rank',
    'Source Filename',
    'Candidate Name',
    'Email',
    'Phone',
    'Current Role',
    'Experience Years',
    'Match Score',
    'Recommendation',
    'Matched Skills',
    'Missing Skills',
    'Strengths',
    'Concerns',
    'Education',
    'AI Summary',
    'Parsing Status',
    'Analysis Status',
    'AI Provider',
    'AI Model',
  ];

  const rows = candidates.map((candidate, index) => {
    const analysis = candidate.analysis || {};
    const contact = resolveCandidateContact(candidate);
    return [
      index + 1,
      candidate.originalFileName,
      analysis.candidateName || candidate.originalFileName,
      contact.email,
      contact.phone,
      analysis.currentRole,
      analysis.totalExperienceYears ?? '',
      analysis.matchScore ?? '',
      labelize(analysis.recommendation || ''),
      cleanList(analysis.matchedSkills).join('; '),
      cleanList(analysis.missingSkills).join('; '),
      cleanList(analysis.strengths).join('; '),
      cleanList(analysis.concerns).join('; '),
      cleanList(analysis.education).join('; '),
      analysis.summary,
      labelize(candidate.parsingStatus),
      labelize(candidate.analysisStatus),
      candidate.aiProvider,
      candidate.aiModel,
    ];
  });

  return csvDocument(headers, rows);
}

function firstWords(value, limit = 5) {
  const words = cleanText(value)
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (words.length <= limit) return words.join(' ');
  return `${words.slice(0, limit).join(' ')}...`;
}

export function createScreeningHistoryCsv(screenings) {
  const headers = [
    'Screening ID',
    'Created Date',
    'Uploaded Resume Filenames',
    'Total Candidates',
    'Parsed Candidates',
    'Parsing Failed',
    'AI Analyzed',
    'AI Failed',
    'AI Status',
    'Average Match Score',
    'Top Candidate',
    'Top Score',
    'Job Description',
  ];

  const rows = screenings.map((screening) => [
    screening.id || screening._id,
    new Date(screening.createdAt).toLocaleString('en-IN'),
    (screening.resumeFileNames || []).join('; '),
    screening.totalCandidates,
    screening.parsedCandidates,
    screening.failedCandidates,
    screening.analyzedCandidates || 0,
    screening.failedAnalysisCandidates || 0,
    labelize(screening.analysisStatus),
    screening.averageMatchScore ?? '',
    screening.topCandidateName || '',
    screening.topScore ?? '',
    firstWords(screening.jobDescription, 5),
  ]);

  return csvDocument(headers, rows);
}
