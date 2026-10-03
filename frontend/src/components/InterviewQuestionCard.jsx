import React, { useEffect, useMemo, useState } from 'react';

const CATEGORY_LABELS = {
  technical: 'Technical', behavioral: 'Behavioral', situational: 'Situational', resume_based: 'Resume based',
  project_based: 'Project based', problem_solving: 'Problem solving', leadership: 'Leadership', culture_fit: 'Culture fit',
};

function RatingSelect({ label, value, onChange }) {
  return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400">{[0,1,2,3,4,5].map((score) => <option key={score} value={score}>{score === 0 ? 'Not scored' : `${score} / 5`}</option>)}</select></label>;
}

export default function InterviewQuestionCard({ question, index, canManage, isFirst, isLast, onUpdate, onSaveResponse, onEvaluate, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [questionText, setQuestionText] = useState(question.question);
  const [notes, setNotes] = useState(question.interviewerNotes || '');
  const [response, setResponse] = useState({
    candidateAnswer: question.candidateAnswer || '',
    interviewerScore: question.interviewerScore || 0,
    technicalAccuracy: question.technicalAccuracy || 0,
    communicationQuality: question.communicationQuality || 0,
    confidenceLevel: question.confidenceLevel || '',
    interviewerComments: question.interviewerComments || '',
    followUpOutcome: question.followUpOutcome || '',
  });
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    setQuestionText(question.question);
    setNotes(question.interviewerNotes || '');
    setResponse({
      candidateAnswer: question.candidateAnswer || '',
      interviewerScore: question.interviewerScore || 0,
      technicalAccuracy: question.technicalAccuracy || 0,
      communicationQuality: question.communicationQuality || 0,
      confidenceLevel: question.confidenceLevel || '',
      interviewerComments: question.interviewerComments || '',
      followUpOutcome: question.followUpOutcome || '',
    });
  }, [question]);

  const responseChanged = useMemo(() => JSON.stringify(response) !== JSON.stringify({
    candidateAnswer: question.candidateAnswer || '', interviewerScore: question.interviewerScore || 0,
    technicalAccuracy: question.technicalAccuracy || 0, communicationQuality: question.communicationQuality || 0,
    confidenceLevel: question.confidenceLevel || '', interviewerComments: question.interviewerComments || '',
    followUpOutcome: question.followUpOutcome || '',
  }), [response, question]);

  async function save(payload) { setSaving(true); try { await onUpdate(question.id, payload); } finally { setSaving(false); } }
  async function saveResponse() { setSaving(true); try { await onSaveResponse(question.id, response); } finally { setSaving(false); } }
  async function evaluate() { setEvaluating(true); try { await onEvaluate(question.id, response.candidateAnswer); } finally { setEvaluating(false); } }
  function updateResponse(field, value) { setResponse((current) => ({ ...current, [field]: value })); }

  const evaluation = question.aiEvaluation;

  return <article className={`rounded-2xl border p-5 transition ${question.isAsked ? 'border-emerald-500/30 bg-emerald-500/[.04]' : 'border-slate-800 bg-[#0b1220]'}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black ${question.isAsked ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'}`}>{question.isAsked ? '✓' : index + 1}</span><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-brand-300">{CATEGORY_LABELS[question.category] || question.category}</span><span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-400">{question.difficulty}</span>{question.interviewerScore > 0 && <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-300">{question.interviewerScore}/5</span>}</div>{editing ? <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-brand-400" /> : <h3 className="text-base font-bold leading-7 text-white">{question.question}</h3>}</div></div>
      <div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => save({ isAsked: !question.isAsked })} disabled={saving} className={`rounded-lg px-3 py-2 text-xs font-black ${question.isAsked ? 'border border-slate-700 text-slate-300' : 'bg-emerald-500 text-white'}`}>{question.isAsked ? 'Mark unasked' : 'Mark asked'}</button><button onClick={() => setExpanded((value) => !value)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">{expanded ? 'Hide details' : 'Open response'}</button>{canManage && <><button disabled={isFirst} onClick={() => onMove(question.id, -1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">↑</button><button disabled={isLast} onClick={() => onMove(question.id, 1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">↓</button><button onClick={() => setEditing((value) => !value)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">{editing ? 'Cancel' : 'Edit'}</button><button onClick={() => onDelete(question.id)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300">Delete</button></>}</div>
    </div>

    {editing && <div className="mt-3 flex justify-end"><button disabled={saving || questionText.trim().length < 10} onClick={async () => { await save({ question: questionText.trim() }); setEditing(false); }} className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Save question</button></div>}

    {expanded && <div className="mt-5 space-y-5 border-t border-slate-800 pt-5">
      <div className="grid gap-4 lg:grid-cols-2"><section><h4 className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Expected answer points</h4><ul className="mt-2 space-y-2">{question.expectedPoints?.length ? question.expectedPoints.map((item) => <li key={item} className="flex gap-2 text-sm text-slate-300"><span className="text-emerald-400">•</span>{item}</li>) : <li className="text-sm text-slate-500">None supplied.</li>}</ul></section><section><h4 className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Evaluation guidance</h4><p className="mt-2 text-sm leading-6 text-slate-300">{question.evaluationGuidance || 'Use professional judgment and the expected points.'}</p></section></div>

      <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-slate-500">Candidate answer</span><textarea value={response.candidateAnswer} onChange={(event) => updateResponse('candidateAnswer', event.target.value)} placeholder="Record the candidate's answer as accurately as possible…" className="min-h-36 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-brand-400" /></label>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><RatingSelect label="Overall answer" value={response.interviewerScore} onChange={(value) => updateResponse('interviewerScore', value)} /><RatingSelect label="Technical accuracy" value={response.technicalAccuracy} onChange={(value) => updateResponse('technicalAccuracy', value)} /><RatingSelect label="Communication" value={response.communicationQuality} onChange={(value) => updateResponse('communicationQuality', value)} /><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Confidence</span><select value={response.confidenceLevel} onChange={(event) => updateResponse('confidenceLevel', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400"><option value="">Not set</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
      <div className="grid gap-4 lg:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Interviewer comments</span><textarea value={response.interviewerComments} onChange={(event) => updateResponse('interviewerComments', event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200 outline-none focus:border-brand-400" /></label><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-slate-500">Follow-up outcome</span><textarea value={response.followUpOutcome} onChange={(event) => updateResponse('followUpOutcome', event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200 outline-none focus:border-brand-400" /></label></div>
      <div className="flex flex-wrap justify-end gap-2"><button disabled={evaluating || response.candidateAnswer.trim().length < 10} onClick={evaluate} className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-xs font-black text-brand-300 disabled:opacity-40">{evaluating ? 'Evaluating…' : 'AI-assisted evaluation'}</button><button disabled={saving || !responseChanged} onClick={saveResponse} className="rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save answer & score'}</button></div>

      {evaluation && <section className="rounded-2xl border border-brand-500/20 bg-brand-500/[.06] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-black uppercase tracking-[.14em] text-brand-300">AI-assisted review</span><h4 className="mt-1 font-black text-white">Suggested score: {evaluation.suggestedScore}/5</h4></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-slate-950/60 px-3 py-1.5 text-slate-300">Coverage {evaluation.coverageScore}%</span><span className="rounded-full bg-slate-950/60 px-3 py-1.5 text-slate-300">Correctness {evaluation.technicalCorrectness}%</span><span className="rounded-full bg-slate-950/60 px-3 py-1.5 text-slate-300">Clarity {evaluation.communicationClarity}%</span></div></div><p className="mt-3 text-sm leading-6 text-slate-300">{evaluation.feedback}</p>{evaluation.missingPoints?.length > 0 && <div className="mt-3"><strong className="text-xs uppercase tracking-wide text-slate-500">Missing points</strong><ul className="mt-2 space-y-1 text-sm text-slate-300">{evaluation.missingPoints.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{evaluation.suggestedFollowUp && <p className="mt-3 text-sm text-brand-300"><strong>Suggested follow-up:</strong> {evaluation.suggestedFollowUp}</p>}<p className="mt-3 text-xs text-slate-600">AI guidance is advisory. The interviewer makes the final decision.</p></section>}
    </div>}

    <div className="mt-5 border-t border-slate-800 pt-4"><label className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Quick notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="General observations…" className="mt-2 min-h-20 w-full rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200 outline-none focus:border-brand-400" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-600">{notes.length}/5000</span><button disabled={saving || notes === (question.interviewerNotes || '')} onClick={() => save({ interviewerNotes: notes })} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-black text-slate-300 disabled:opacity-40">{saving ? 'Saving…' : 'Save notes'}</button></div></div>
  </article>;
}
