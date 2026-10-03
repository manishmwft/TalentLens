function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function layout({ organizationName, title, body, brandColor = '#6366F1' }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)"><tr><td style="background:${escapeHtml(brandColor)};padding:24px 30px;color:#fff"><div style="font-size:20px;font-weight:800">${escapeHtml(organizationName || 'TalentLens AI')}</div><div style="margin-top:4px;font-size:13px;opacity:.85">AI Hiring Platform</div></td></tr><tr><td style="padding:30px"><h1 style="margin:0 0 18px;font-size:25px">${escapeHtml(title)}</h1>${body}<p style="margin:28px 0 0;color:#64748b;font-size:12px;line-height:1.6">This message contains private recruitment information. Do not forward it to anyone.</p></td></tr></table></td></tr></table></body></html>`;
}

export function renderEmailTemplate(template, data) {
  if (template === 'candidate_password_reset') {
    const title = 'Reset your TalentLens candidate password';
    const body = `
      <p style="font-size:16px;line-height:1.7">Hello <strong>${escapeHtml(data.candidateName || 'Candidate')}</strong>,</p>
      <p style="font-size:15px;line-height:1.7">We received a request to reset your candidate portal password.</p>
      <p style="margin:26px 0"><a href="${escapeHtml(data.resetUrl)}" style="display:inline-block;background:${escapeHtml(data.brandColor || '#6366F1')};color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">Reset password</a></p>
      <p style="font-size:13px;color:#64748b;line-height:1.6">This link expires in ${escapeHtml(data.expiresIn || '60 minutes')}. If you did not request this reset, you can ignore this email.</p>`;
    return { subject: title, text: `Hello ${data.candidateName || 'Candidate'},\n\nReset your password: ${data.resetUrl}\n\nThis link expires in ${data.expiresIn || '60 minutes'}.`, html: layout({ organizationName: data.organizationName, title, body, brandColor: data.brandColor }) };
  }

  if (template !== 'candidate_interview_invitation') throw new Error(`Unknown email template: ${template}`);

  const title = `Your automated interview for ${data.jobTitle || 'the role'}`;
  const credentialBlock = data.accountCreated
    ? `<div style="margin-bottom:10px"><strong>Temporary password:</strong> <code style="background:#e2e8f0;padding:4px 8px;border-radius:6px">${escapeHtml(data.temporaryPassword)}</code></div>`
    : `<div style="margin-bottom:10px"><strong>Account:</strong> Use your existing TalentLens candidate account and current password.</div>`;
  const signInNote = data.accountCreated
    ? 'You will be required to change your temporary password after signing in.'
    : 'Sign in with your existing candidate account. Your current password has not been changed.';
  const body = `
    <p style="font-size:16px;line-height:1.7">Hello <strong>${escapeHtml(data.candidateName || 'Candidate')}</strong>,</p>
    <p style="font-size:15px;line-height:1.7">You have been shortlisted and invited to complete an automated audio and video interview with <strong>${escapeHtml(data.organizationName)}</strong>.</p>
    <div style="margin:22px 0;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
      <div style="margin-bottom:10px"><strong>Login email:</strong> ${escapeHtml(data.email)}</div>
      ${credentialBlock}
      <div><strong>Complete before:</strong> ${escapeHtml(data.expiresAtLabel)}</div>
    </div>
    <p style="font-size:14px;line-height:1.7">${signInNote} The interview presents one question at a time and records audio and webcam video.</p>
    <p style="margin:26px 0"><a href="${escapeHtml(data.loginUrl)}" style="display:inline-block;background:${escapeHtml(data.brandColor || '#6366F1')};color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">Open candidate portal</a></p>
    <p style="font-size:13px;color:#64748b;line-height:1.6">If the button does not work, open this address:<br>${escapeHtml(data.loginUrl)}</p>`;

  return {
    subject: title,
    text: data.accountCreated
      ? `Hello ${data.candidateName || 'Candidate'},\n\nYou have been invited to complete an automated interview for ${data.jobTitle || 'the role'} with ${data.organizationName}.\n\nLogin: ${data.email}\nTemporary password: ${data.temporaryPassword}\nComplete before: ${data.expiresAtLabel}\nPortal: ${data.loginUrl}\n\nYou must change the temporary password after signing in.`
      : `Hello ${data.candidateName || 'Candidate'},\n\nYou have been invited to complete another automated interview for ${data.jobTitle || 'the role'} with ${data.organizationName}.\n\nLogin: ${data.email}\nUse your existing TalentLens password.\nComplete before: ${data.expiresAtLabel}\nPortal: ${data.loginUrl}\n\nYour existing password has not been changed.`,
    html: layout({ organizationName: data.organizationName, title, body, brandColor: data.brandColor }),
  };
}
