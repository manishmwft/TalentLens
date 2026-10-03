import { Organization } from '../models/Organization.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

function serialize(organization) {
  return {
    id: organization._id.toString(), name: organization.name, legalName: organization.legalName,
    slug: organization.slug, industry: organization.industry, companySize: organization.companySize,
    foundedYear: organization.foundedYear, website: organization.website, email: organization.email,
    phone: organization.phone, taxId: organization.taxId, registrationNumber: organization.registrationNumber,
    description: organization.description, logoUrl: organization.logoUrl, brandColor: organization.brandColor,
    linkedinUrl: organization.linkedinUrl, twitterUrl: organization.twitterUrl,
    address: organization.address || {}, timezone: organization.timezone, dateFormat: organization.dateFormat,
    currency: organization.currency, defaultHiringEmail: organization.defaultHiringEmail,
    defaultInterviewDuration: organization.defaultInterviewDuration, workingDays: organization.workingDays || [],
    isActive: organization.isActive, createdAt: organization.createdAt, updatedAt: organization.updatedAt,
  };
}

export const getOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.user.organization);
  if (!organization) throw new AppError('Organization not found', 404);
  res.json({ success: true, organization: serialize(organization) });
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.user.organization);
  if (!organization) throw new AppError('Organization not found', 404);
  Object.assign(organization, req.body);
  await organization.save();
  res.json({ success: true, organization: serialize(organization) });
});
