import React, { useEffect, useMemo, useState } from 'react';
import { createHiringDecision, getCandidateTimeline } from '../services/screeningService.js';

const DECISIONS = [
  ['move_forward', 'Move forward'],
  ['hold', 'Hold'],
  ['reject', 'Reject'],
  ['offer', 'Offer'],
  ['hired', 'Hired'],
];

const EVENT_TONES = {
  resume_uploaded: 'bg-sky-500',
  analysis_completed: 'bg-emerald-500',
  analysis_failed: 'bg-rose-500',
  status_changed: 'bg-violet-500',
  notes_updated: 'bg-slate-500',
  interview_scheduled: 'bg-amber-500',
  interview_started: 'bg-indigo-500',
  interview_completed: 'bg-emerald-500',
  interview_cancelled: 'bg-rose-500',
  feedback_submitted: 'bg-cyan-500',
  decision_recorded: 'bg-brand-500',
};

function humanize(value) {
  return String(value || '').replaceAll('_', ' ');
}

function DecisionBadge({ decision }) {
  const tones = {
    move_forward: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    hold: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    reject: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    offer: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    hired: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black capitalize ${tones[decision] || 'border-slate-700 bg-slate-800 text-slate-300'}`}>{humanize(decision)}</span>;
}

export default function CandidateDecisionTimeline({ candidate, canManage = false, onCandidateUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ decision: 'move_forward', reason: '', notes: '' });

  async function load() {
    try {
      setLoading(true);
      setError('');
      setData(await getCandidateTimeline(candidate.screeningId, candidate.id));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load candidate timeline.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [candidate.screeningId, candidate.id]);

  const latestDecision = data?.latestDecision || null;
  const events = useMemo(() => data?.events || [], [data]);

  async function submitDecision(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      const result = await createHiringDecision(candidate.screeningId, candidate.id, form);
      setData(result);
      setForm((current) => ({ ...current, reason: '', notes: '' }));
      setSuccess('Hiring decision recorded');
      onCandidateUpdated?.({ ...candidate, workflowStatus: result.candidate?.workflowStatus || candidate.workflowStatus });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to record hiring decision.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3.5 py-3 text-sm text-slate-200 outline-none transition focus:border-brand-500';

  return (
    <section className="mt-6 border-t border-slate-800 pt-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-white">Hiring decision & activity timeline</h3>
          <p className="mt-1 text-xs text-slate-500">A permanent audit trail of review, interview, feedback, and decision activity.</p>
        </div>
        {latestDecision && <DecisionBadge decision={latestDecision.decision} />}
      </div>

      {latestDecision && (
        <div className="mb-5 rounded-2xl border border-brand-500/25 bg-brand-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.14em] text-brand-300">Latest decision</span>
              <p className="mt-2 text-sm font-bold text-white">{latestDecision.reason}</p>
              {latestDecision.notes && <p className="mt-2 text-sm leading-6 text-slate-400">{latestDecision.notes}</p>}
            </div>
            <div className="text-right text-xs text-slate-500">
              <strong className="block text-slate-300">{latestDecision.decidedBy?.name || 'User'}</strong>
              <span>{new Date(latestDecision.decidedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <form onSubmit={submitDecision} className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/25 p-4">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Decision</span>
              <select className={inputClass} value={form.decision} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
                {DECISIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Reason *</span>
              <input className={inputClass} maxLength={2000} minLength={3} required placeholder="Why is this decision being made?" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Decision notes</span>
            <textarea className={`${inputClass} min-h-24 resize-y`} maxLength={5000} placeholder="Optional context, next steps, approvals, or compensation notes..." value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="mt-4 flex justify-end">
            <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-brand-600 disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Recording…' : 'Record decision'}</button>
          </div>
        </form>
      )}

      {success && <p className="mb-4 text-xs font-bold text-emerald-400">{success}</p>}
      {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-500">Loading timeline…</div>
      ) : events.length ? (
        <div className="relative space-y-0 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-slate-800">
          {events.map((event) => (
            <div className="relative flex gap-4 pb-5" key={event.id}>
              <span className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-[#0b1220] ${EVENT_TONES[event.type] || 'bg-slate-500'}`} />
              <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/25 p-3.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <strong className="block text-sm text-slate-200">{event.title}</strong>
                    {event.description && <p className="mt-1 text-sm leading-6 text-slate-500">{event.description}</p>}
                  </div>
                  <time className="shrink-0 text-xs text-slate-600">{new Date(event.occurredAt).toLocaleString()}</time>
                </div>
                <p className="mt-2 text-[11px] text-slate-600">{event.actor?.name || 'System'} · {humanize(event.actor?.role || 'system')}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">No candidate activity has been recorded yet.</div>
      )}
    </section>
  );
}
