import { IntegrationCredential } from '../models/IntegrationCredential.js';
import { hashIntegrationToken } from '../services/integrationCredentialService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireWordPressIntegration = asyncHandler(async (req, _res, next) => {
  const authorization = String(req.get('authorization') || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';

  if (!token) {
    throw new AppError('Invalid or missing API credentials.', 401, {
      code: 'INVALID_INTEGRATION_CREDENTIALS',
    });
  }

  const tokenHash = hashIntegrationToken(token);

  const credential = await IntegrationCredential.findOne({
    provider: 'wordpress',
    tokenHash,
    isActive: true,
  })
    .select('+tokenHash')
    .populate('organization', '_id name isActive');

  if (!credential || !credential.organization) {
    throw new AppError('Invalid or missing API credentials.', 401, {
      code: 'INVALID_INTEGRATION_CREDENTIALS',
    });
  }

  if (credential.organization.isActive === false) {
    throw new AppError('The organization linked to this integration is inactive.', 403, {
      code: 'INTEGRATION_ORGANIZATION_INACTIVE',
    });
  }

  req.integration = {
    credentialId: credential._id,
    provider: credential.provider,
    organizationId: credential.organization._id,
    organizationName: credential.organization.name || '',
    createdBy: credential.createdBy || null,
  };

  // Usage telemetry must never block a valid application request.
  IntegrationCredential.updateOne(
    { _id: credential._id },
    { $set: { lastUsedAt: new Date() } },
  ).catch(() => {});

  next();
});
