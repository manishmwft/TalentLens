import React, { useMemo, useState } from 'react';
import { sendAutomatedInterviewInvitation } from '../services/candidateInvitationService.js';

function defaultExpiry() {
  const date = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AutomatedInterviewInviteModal({ interview, onClose, onSent }) {
  const config = interview.automatedConfig || {};
  const [form, setForm] = useState({
    expiresAt: config.expiresAt
      ? new Date(new Date(config.expiresAt).getTime() - new Date(config.expiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : defaultExpiry(),
    durationMinutes: interview.durationMinutes || 45,
    language: config.language || 'en',
    preparationTimeSeconds: config.preparationTimeSeconds ?? 30,
    questionTimeSeconds: config.questionTimeSeconds ?? 180,
    maxRecordingSeconds: config.maxRecordingSeconds ?? 180,
    instructions: interview.instructions || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const email = interview.candidateEmail || interview.candidate?.analysis?.email || '';
  const hasExistingAccount = Boolean(interview.candidateAccountId);
  const canSubmit = useMemo(
    () => Boolean(email && form.expiresAt && interview.questionCount > 0),
    [email, form.expiresAt, interview.questionCount],
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await sendAutomatedInterviewInvitation(interview.id, {
        ...form,
        expiresAt: new Date(form.expiresAt).toISOString(),
      });
      setResult(data);
      onSent?.(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send the candidate invitation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1220] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Final step</span>
            <h2 className="mt-2 text-2xl font-black text-white">Send candidate invitation</h2>
            <p className="mt-1 text-sm text-slate-500">The approved {interview.questionCount} questions will be locked for this candidate interview.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </div>

        {result ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
              <strong className="text-emerald-300">Invitation sent successfully</strong>
              <p className="mt-2 text-sm text-slate-300">Email status: {result.email?.status} via {result.email?.provider}</p>
              {result.temporaryPassword && (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <strong>Mock email temporary password:</strong> {result.temporaryPassword}
                </div>
              )}
            </div>
            <button className="w-full rounded-xl bg-brand-500 py-3 font-black text-white" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-300">Candidate email</span>
              <input value={email} disabled className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-400" />
              {!email && <small className="mt-2 block text-rose-400">The resume analysis does not contain an email address.</small>}
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-300">Interview expires</span>
              <input type="datetime-local" required value={form.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-300">Expected duration</span>
              <input type="number" min="15" max="240" value={form.durationMinutes} onChange={(event) => update('durationMinutes', Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-300">Preparation seconds</span>
              <input type="number" min="0" max="600" value={form.preparationTimeSeconds} onChange={(event) => update('preparationTimeSeconds', Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-300">Answer timer seconds</span>
              <input type="number" min="30" max="3600" value={form.questionTimeSeconds} onChange={(event) => { const value = Number(event.target.value); setForm((current) => ({ ...current, questionTimeSeconds: value, maxRecordingSeconds: value })); }} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-300">Instructions</span>
              <textarea rows="3" value={form.instructions} onChange={(event) => update('instructions', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Optional instructions for the candidate" />
            </label>
            {error && <div className="sm:col-span-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-3 font-bold text-slate-300">Cancel</button>
              <button disabled={!canSubmit || loading} className="rounded-xl bg-brand-500 px-5 py-3 font-black text-white disabled:opacity-50">{loading ? 'Sending invitation…' : hasExistingAccount ? 'Send interview invitation' : 'Create account & send email'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
