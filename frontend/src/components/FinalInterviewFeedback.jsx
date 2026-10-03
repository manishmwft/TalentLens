import React, { useEffect, useMemo, useState } from 'react';

const defaultForm = {
  technicalScore: 0,
  communicationScore: 0,
  problemSolvingScore: 0,
  roleFitScore: 0,
  recommendation: 'hold',
  strengths: '',
  concerns: '',
  finalComments: '',
};

function RatingField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-brand-400">
        {[0, 1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score === 0 ? 'Not scored' : `${score} / 5`}</option>)}
      </select>
    </label>
  );
}

export default function FinalInterviewFeedback({ interview, onSubmit }) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (interview?.finalFeedback) {
      setForm({ ...defaultForm, ...interview.finalFeedback, recommendation: interview.finalFeedback.recommendation || 'hold' });
    }
  }, [interview]);

  const overall = useMemo(() => {
    const values = [form.technicalScore, form.communicationScore, form.problemSolvingScore, form.roleFitScore];
    return Math.round((values.reduce((sum, item) => sum + Number(item || 0), 0) / 20) * 100);
  }, [form]);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><span className="text-xs font-black uppercase tracking-[.16em] text-brand-400">Final evaluation</span><h2 className="mt-2 text-2xl font-black text-white">Interview feedback</h2><p className="mt-2 text-sm text-slate-500">Submit the final human decision after reviewing answers and scores.</p></div>
        <div className="rounded-2xl border border-brand-500/25 bg-brand-500/10 px-5 py-3 text-center"><span className="block text-xs font-bold text-brand-300">Calculated score</span><strong className="text-2xl text-white">{overall}%</strong></div>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RatingField label="Technical" value={form.technicalScore} onChange={(value) => update('technicalScore', value)} />
          <RatingField label="Communication" value={form.communicationScore} onChange={(value) => update('communicationScore', value)} />
          <RatingField label="Problem solving" value={form.problemSolvingScore} onChange={(value) => update('problemSolvingScore', value)} />
          <RatingField label="Role fit" value={form.roleFitScore} onChange={(value) => update('roleFitScore', value)} />
        </div>

        <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Final recommendation</span><select value={form.recommendation} onChange={(event) => update('recommendation', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-brand-400"><option value="strong_hire">Strong hire</option><option value="hire">Hire</option><option value="hold">Hold</option><option value="no_hire">No hire</option></select></label>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Key strengths</span><textarea value={form.strengths} onChange={(event) => update('strengths', event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200 outline-none focus:border-brand-400" /></label>
          <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Key concerns</span><textarea value={form.concerns} onChange={(event) => update('concerns', event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200 outline-none focus:border-brand-400" /></label>
        </div>

        <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Final comments</span><textarea value={form.finalComments} onChange={(event) => update('finalComments', event.target.value)} className="min-h-32 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200 outline-none focus:border-brand-400" /></label>

        <div className="flex justify-end"><button disabled={saving || [form.technicalScore, form.communicationScore, form.problemSolvingScore, form.roleFitScore].some((value) => Number(value) === 0)} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Submitting…' : interview?.finalFeedback?.submittedAt ? 'Update final feedback' : 'Submit final feedback'}</button></div>
      </form>
    </section>
  );
}
