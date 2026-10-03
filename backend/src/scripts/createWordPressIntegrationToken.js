import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { IntegrationCredential } from '../models/IntegrationCredential.js';
import { Organization } from '../models/Organization.js';
import {
  generateIntegrationToken,
  getTokenDisplayParts,
  hashIntegrationToken,
} from '../services/integrationCredentialService.js';

async function main() {
  const organizationId = String(process.argv[2] || '').trim();
  const name = String(process.argv.slice(3).join(' ') || 'WordPress Careers').trim();

  if (!mongoose.isValidObjectId(organizationId)) {
    console.error('Usage: node src/scripts/createWordPressIntegrationToken.js <organizationId> [credential name]');
    console.error('Error: organizationId must be a valid MongoDB ObjectId.');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const organization = await Organization.findById(organizationId).select('_id name isActive');
  if (!organization) {
    throw new Error('Organization not found.');
  }
  if (organization.isActive === false) {
    throw new Error('Organization is inactive.');
  }

  const token = generateIntegrationToken();
  const tokenHash = hashIntegrationToken(token);
  const { tokenPrefix, tokenLastFour } = getTokenDisplayParts(token);

  const credential = await IntegrationCredential.create({
    organization: organization._id,
    provider: 'wordpress',
    name,
    tokenHash,
    tokenPrefix,
    tokenLastFour,
    isActive: true,
  });

  console.log('');
  console.log('WordPress integration credential created successfully.');
  console.log(`Organization: ${organization.name || organization._id.toString()}`);
  console.log(`Credential ID: ${credential._id.toString()}`);
  console.log('');
  console.log('Bearer token (copy now; TalentLens stores only its SHA-256 hash):');
  console.log(token);
  console.log('');
  console.log('WordPress header:');
  console.log(`Authorization: Bearer ${token}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
