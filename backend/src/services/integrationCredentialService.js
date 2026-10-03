import crypto from 'crypto';

export function hashIntegrationToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

export function generateIntegrationToken() {
  const random = crypto.randomBytes(32).toString('hex');
  return `tl_wp_${random}`;
}

export function getTokenDisplayParts(token) {
  const value = String(token || '');
  return {
    tokenPrefix: value.slice(0, Math.min(12, value.length)),
    tokenLastFour: value.slice(-4),
  };
}
