/** TalentLens public Vercel Blob storage adapter. */

const normalizePathSegment = (value, fallback = 'unknown') => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

export const buildBlobPath = ({ organizationId, category, ownerId, filename }) => {
  const org = normalizePathSegment(organizationId, 'unscoped');
  const type = normalizePathSegment(category, 'files');
  const owner = normalizePathSegment(ownerId, 'general');
  const name = normalizePathSegment(filename, `file-${Date.now()}`);
  return `talentlens/organizations/${org}/${type}/${owner}/${name}`;
};

function assertBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured. Connect a Vercel Blob store or set the token before uploading files.');
  }
}

export async function uploadPublicFile({ organizationId, category, ownerId, filename, data, contentType, addRandomSuffix = true }) {
  if (!data) throw new Error('Blob upload requires file data.');
  assertBlobConfigured();
  const { put } = await import('@vercel/blob');
  const pathname = buildBlobPath({ organizationId, category, ownerId, filename });
  const blob = await put(pathname, data, {
    access: 'public',
    addRandomSuffix,
    ...(contentType ? { contentType } : {}),
  });
  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl || blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType || contentType || null,
    contentDisposition: blob.contentDisposition || null,
  };
}

export async function deleteBlob(urlOrPathname) {
  if (!urlOrPathname) return;
  assertBlobConfigured();
  const { del } = await import('@vercel/blob');
  await del(urlOrPathname);
}
