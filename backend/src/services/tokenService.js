import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      accountType: 'staff',
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function signCandidateAccessToken(account) {
  return jwt.sign(
    {
      sub: account._id.toString(),
      accountType: 'candidate',
      organization: account.organization.toString(),
    },
    env.jwtSecret,
    { expiresIn: env.candidateJwtExpiresIn },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
