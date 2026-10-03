import React, { useState } from 'react';

const CATEGORY_LABELS = {
  technical: 'Technical',
  behavioral: 'Behavioral',
  situational: 'Situational',
  resume_based: 'Resume based',
  project_based: 'Project based',
  problem_solving: 'Problem solving',
  leadership: 'Leadership',
  culture_fit: 'Culture fit',
};

export default function AutomatedQuestionSetupCard({
  question,
  index,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.question);
  const [saving, setSaving] = useState(false);

  async function saveQuestion() {
    setSaving(true);
    try {
      await onUpdate(question.id, { question: text.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-sm font-black text-brand-300">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-brand-300">{CATEGORY_LABELS[question.category] || question.category}</span>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-400">{question.difficulty}</span>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-500">{question.source || 'ai'}</span>
            </div>
            {editing ? (
              <textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-brand-400" />
            ) : (
              <h3 className="text-base font-bold leading-7 text-white">{question.question}</h3>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={() => setExpanded((value) => !value)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">{expanded ? 'Hide guidance' : 'Review guidance'}</button>
          <button disabled={isFirst} onClick={() => onMove(question.id, -1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">↑</button>
          <button disabled={isLast} onClick={() => onMove(question.id, 1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">↓</button>
          <button onClick={() => { setEditing((value) => !value); setText(question.question); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">{editing ? 'Cancel' : 'Edit'}</button>
          <button onClick={() => onDelete(question.id)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300">Delete</button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex justify-end">
          <button disabled={saving || text.trim().length < 10} onClick={saveQuestion} className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save question'}</button>
        </div>
      )}

      {expanded && (
        <div className="mt-5 grid gap-5 border-t border-slate-800 pt-5 lg:grid-cols-2">
          <section>
            <h4 className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Expected answer points</h4>
            <ul className="mt-2 space-y-2">
              {question.expectedPoints?.length ? question.expectedPoints.map((item) => <li key={item} className="flex gap-2 text-sm text-slate-300"><span className="text-emerald-400">•</span>{item}</li>) : <li className="text-sm text-slate-500">None supplied.</li>}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Evaluation guidance</h4>
            <p className="mt-2 text-sm leading-6 text-slate-300">{question.evaluationGuidance || 'AI will evaluate the transcript against the expected answer points.'}</p>
          </section>
        </div>
      )}
    </article>
  );
}
