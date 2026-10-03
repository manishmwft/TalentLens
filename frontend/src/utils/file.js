export const MAX_RESUME_FILES = 10;
export const MAX_RESUME_SIZE = 5 * 1024 * 1024;

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isAllowedResume(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.docx');
}
