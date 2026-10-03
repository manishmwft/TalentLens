import React, { useEffect, useState } from 'react';
import { assignInterview, getInterviewers } from '../services/interviewService.js';

function localDateTimeValue(date = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

export default function InterviewAssignmentModal({ candidate, onClose, onAssigned }) {
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    interviewerId: '',
    scheduledAt: localDateTimeValue(),
    durationMinutes: 45,
    mode: 'video',
    meetingLink: '',
    location: '',
    instructions: '',
  });

  useEffect(() => {
    getInterviewers()
      .then((items) => {
        setInterviewers(items);
        if (items[0]) setForm((current) => ({ ...current, interviewerId: items[0].id }));
      })
      .catch((e) => setError(e.response?.data?.message || 'Unable to load interviewers.'))
      .finally(() => setLoading(false));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const interview = await assignInterview(candidate.screeningId, candidate.id, {
        ...form,
        durationMinutes: Number(form.durationMinutes),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      onAssigned?.(interview);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to assign interview.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b1220] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Interview assignment</p><h2 className="mt-2 text-2xl font-black text-white">{candidate.analysis?.candidateName || candidate.originalFileName}</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">Close</button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        {loading ? <p className="text-sm text-slate-500">Loading interviewers…</p> : interviewers.length === 0 ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">No active interviewer is available. Create a team member with the Interviewer role first.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-300">Interviewer</span><select name="interviewerId" value={form.interviewerId} onChange={updateField} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500">{interviewers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-300">Date and time</span><input required type="datetime-local" name="scheduledAt" value={form.scheduledAt} onChange={updateField} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500" /></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-300">Duration</span><select name="durationMinutes" value={form.durationMinutes} onChange={updateField} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label>
            <label><span className="mb-2 block text-sm font-bold text-slate-300">Mode</span><select name="mode" value={form.mode} onChange={updateField} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500"><option value="video">Video</option><option value="phone">Phone</option><option value="in_person">In person</option></select></label>
            {form.mode === 'in_person' ? <label><span className="mb-2 block text-sm font-bold text-slate-300">Location</span><input name="location" value={form.location} onChange={updateField} placeholder="Office or room" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500" /></label> : <label><span className="mb-2 block text-sm font-bold text-slate-300">Meeting link</span><input name="meetingLink" value={form.meetingLink} onChange={updateField} placeholder="https://..." className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500" /></label>}
            <label className="md:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-300">Instructions</span><textarea name="instructions" value={form.instructions} onChange={updateField} maxLength={2000} placeholder="Focus areas, panel details, preparation notes..." className="min-h-28 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 outline-none focus:border-brand-500" /></label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800">Cancel</button><button disabled={loading || saving || interviewers.length === 0} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Assigning…' : 'Assign interview'}</button></div>
      </form>
    </div>
  );
}
