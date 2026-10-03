export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECRUITER: 'recruiter',
  HIRING_MANAGER: 'hiring_manager',
  INTERVIEWER: 'interviewer',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Admin',
  [ROLES.RECRUITER]: 'Recruiter',
  [ROLES.HIRING_MANAGER]: 'Hiring Manager',
  [ROLES.INTERVIEWER]: 'Interviewer',
});
