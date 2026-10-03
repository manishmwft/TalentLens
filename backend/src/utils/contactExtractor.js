function cleanSourceText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\uFFFE|\uFFFF/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractEmail(resumeText = '') {
  const match = cleanSourceText(resumeText).match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  );

  return match?.[0]?.replace(/[),.;:]+$/g, '').trim() || '';
}

function digitCount(value = '') {
  return String(value).replace(/\D/g, '').length;
}

function isProbableDate(value = '') {
  const normalized = String(value).trim();
  return (
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(normalized) ||
    /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)
  );
}

export function extractPhone(resumeText = '') {
  const text = cleanSourceText(resumeText);
  const candidates = text.match(
    /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
  ) || [];

  const phone = candidates.find((candidate) => {
    const digits = digitCount(candidate);
    return digits >= 10 && digits <= 15 && !isProbableDate(candidate);
  });

  return phone
    ? phone.replace(/\s+/g, ' ').replace(/[),.;:]+$/g, '').trim()
    : '';
}

export function extractContactDetails(resumeText = '') {
  return {
    email: extractEmail(resumeText),
    phone: extractPhone(resumeText),
  };
}

export function resolveCandidateContact(candidate) {
  const analysis = candidate?.analysis || {};
  const extracted = extractContactDetails(candidate?.extractedText || '');

  return {
    email:
      extracted.email ||
      analysis.email ||
      analysis.contact?.email ||
      '',
    phone:
      extracted.phone ||
      analysis.phone ||
      analysis.contact?.phone ||
      '',
  };
}
