import nodemailer from 'nodemailer';
import { EmailLog } from '../../models/EmailLog.js';
import { env } from '../../config/env.js';
import { renderEmailTemplate } from './templateService.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (env.emailProvider === 'mock') return null;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  return transporter;
}

export async function sendTemplateEmail({ organization, candidate = null, candidateAccount = null, interview = null, to, template, data, createdBy = null }) {
  const rendered = renderEmailTemplate(template, data);
  const log = await EmailLog.create({
    organization: organization._id || organization,
    candidate,
    candidateAccount,
    interview,
    recipient: to,
    template,
    provider: env.emailProvider,
    subject: rendered.subject,
    status: 'queued',
    createdBy,
  });

  try {
    if (env.emailProvider === 'mock') {
      console.log('\n--- MOCK EMAIL ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${rendered.subject}`);
      console.log(rendered.text);
      console.log('--- END MOCK EMAIL ---\n');
      log.status = 'sent';
      log.providerMessageId = `mock-${log._id}`;
      log.sentAt = new Date();
      await log.save();
      return { log, preview: rendered.text };
    }

    const info = await getTransporter().sendMail({
      from: env.emailFrom,
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    log.status = 'sent';
    log.providerMessageId = info.messageId || '';
    log.sentAt = new Date();
    await log.save();
    return { log, info };
  } catch (error) {
    log.status = 'failed';
    log.error = String(error?.message || error).slice(0, 3000);
    await log.save();
    throw error;
  }
}
