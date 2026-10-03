import { Organization } from '../models/Organization.js';
import { ROLES } from '../constants/roles.js';

function slugify(value) {
  return String(value || 'organization')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55) || 'organization';
}

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (await Organization.exists({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

export async function createOrganizationForUser(user, companyName) {
  const name = String(companyName || `${user.name}'s Workspace`).trim();
  const organization = await Organization.create({
    name,
    slug: await uniqueSlug(name),
    createdBy: user._id,
  });

  user.organization = organization._id;
  user.role = ROLES.ADMIN;
  user.isActive = true;
  await user.save();
  return organization;
}

export async function ensureLegacyUserProvisioned(user) {
  if (user.organization) return user;
  await createOrganizationForUser(user, `${user.name}'s Workspace`);
  return user;
}
