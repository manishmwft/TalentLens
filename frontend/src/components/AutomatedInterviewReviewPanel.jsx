import React, { useMemo, useState } from 'react';

const OPTIONS = [
  ['strong_hire', 'Strong Hire'],
  ['hire', 'Hire'],
  ['hold', 'Hold'],
  ['no_hire', 'No Hire'],
];
const titleFor = (value) => OPTIONS.find(([key]) => key === value)?.[1] || 'Pending';
const tone = (score) =>
  score >= 85 ? 'text-emerald-300' :
  score >= 70 ? 'text-sky-300' :
  score >= 55 ? 'text-amber-300' : 'text-rose-300';

function Metric({ title, value }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
    <span className="text-xs text-slate-500">{title}</span>
    <strong className={`mt-1 block text-2xl ${tone(Number(value || 0))}`}>
      {Math.round(Number(value || 0))}%
    </strong>
  </div>;
}

export default function AutomatedInterviewReviewPanel({
  interview, onRecalculate, onRetryFailed, onApprove,
}) {
  const evaluation = interview?.automatedAttempt?.finalEvaluation;
  const review = evaluation?.staffReview;
  const [notes, setNotes] = useState(review?.notes || '');
  const [score, setScore] = useState(review?.adjustedOverallScore ?? '');
  const [recommendation, setRecommendation] =
    useState(review?.adjustedRecommendation || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const stats = useMemo(() => {
    const answers = interview?.automatedAnswers || [];
    return {
      total: interview?.questions?.length || answers.length,
      uploaded: answers.filter((a) => a.audio?.available).length,
      transcribed: answers.filter((a) => a.transcription?.status === 'completed').length,
      evaluated: answers.filter((a) => a.evaluation?.status === 'completed').length,
      failed: answers.filter((a) =>
        a.transcription?.status === 'failed' || a.evaluation?.status === 'failed').length,
    };
  }, [interview]);

  async function calculate(force) {
    setBusy('calculate'); setMessage('');
    try { const result = await onRecalculate(force); setMessage(result.message); }
    finally { setBusy(''); }
  }
  async function retryFailed() {
    setBusy('retry'); setMessage('');
    try {
      const result = await onRetryFailed();
      setMessage(result.message);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.message || 'Unable to retry failed answers.');
    } finally { setBusy(''); }
  }
  async function approve() {
    setBusy('approve'); setMessage('');
    try {
      await onApprove({
        notes,
        adjustedOverallScore: score === '' ? null : Number(score),
        adjustedRecommendation: recommendation,
      });
      setMessage('Final result approved successfully.');
    } finally { setBusy(''); }
  }

  const ready = Boolean(evaluation?.evaluatedAt);
  const reviewed = evaluation?.status === 'reviewed';
  const integrity = evaluation?.integritySummary || {};

  return <section className="space-y-5 rounded-3xl border border-slate-800 bg-[#0b1220] p-5 md:p-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">
          Automated interview result
        </span>
        <h2 className="mt-2 text-2xl font-black text-white">Final scoring & staff review</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Scores are calculated from completed transcript evaluations. Staff approval is mandatory.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {stats.failed > 0 && onRetryFailed && <button disabled={busy !== ''} onClick={retryFailed}
          className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-300 disabled:opacity-50">
          {busy === 'retry' ? 'Retrying…' : `Retry failed answers (${stats.failed})`}
        </button>}
        <button disabled={busy !== ''} onClick={() => calculate(false)}
          className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 disabled:opacity-50">
          {busy === 'calculate' ? 'Calculating…' : 'Refresh score'}
        </button>
        {!ready && <button disabled={busy !== ''} onClick={() => calculate(true)}
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300 disabled:opacity-50">
          Force partial calculation
        </button>}
      </div>
    </div>

    {message && <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-sm text-sky-200">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Object.entries(stats).map(([key,value]) =>
        <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
          <span className="text-xs capitalize text-slate-500">{key}</span>
          <strong className="mt-1 block text-xl text-white">{value}</strong>
        </div>)}
    </div>

    {!ready ? <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
      <h3 className="font-black text-white">Final score is not ready yet</h3>
      <p className="mt-2 text-sm text-slate-500">
        Wait until all answers are transcribed and evaluated, then refresh the score.
      </p>
    </div> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Overall" value={evaluation.overallScore}/>
        <Metric title="Technical" value={evaluation.technicalScore}/>
        <Metric title="Communication" value={evaluation.communicationScore}/>
        <Metric title="Problem solving" value={evaluation.problemSolvingScore}/>
        <Metric title="Coverage" value={evaluation.coverageScore}/>
        <Metric title="Relevance" value={evaluation.relevanceScore}/>
        <Metric title="Role fit" value={evaluation.roleFitScore}/>
        <Metric title="Resume alignment" value={evaluation.resumeAlignmentScore}/>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <span className="text-xs text-slate-500">AI recommendation</span>
          <strong className="mt-2 block text-xl text-white">{titleFor(evaluation.recommendation)}</strong>
          <p className="mt-3 text-sm leading-6 text-slate-400">{evaluation.summary}</p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <span className="text-xs text-slate-500">Integrity summary</span>
          <strong className={`mt-2 block text-xl ${
            integrity.riskLevel === 'high' ? 'text-rose-300' :
            integrity.riskLevel === 'moderate' ? 'text-amber-300' : 'text-emerald-300'}`}>
            {String(integrity.riskLevel || 'low').toUpperCase()} risk
          </strong>
          <p className="mt-3 text-sm text-slate-400">
            {integrity.totalEvents || 0} event(s), risk score {integrity.riskScore || 0}/100.
          </p>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            {Object.entries(integrity.counts || {}).map(([key,value]) =>
              <div key={key} className="flex justify-between gap-3">
                <span>{key.replaceAll('_',' ')}</span><strong>{value}</strong>
              </div>)}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <span className="text-xs text-slate-500">Review status</span>
          <strong className="mt-2 block text-xl text-white">
            {reviewed ? 'Approved' : 'Pending staff review'}
          </strong>
          {review?.reviewedBy?.name &&
            <p className="mt-3 text-sm text-slate-400">Reviewed by {review.reviewedBy.name}</p>}
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.05] p-5">
          <h3 className="font-black text-emerald-300">Strengths</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {(evaluation.strengths || []).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </article>
        <article className="rounded-2xl border border-amber-500/20 bg-amber-500/[.05] p-5">
          <h3 className="font-black text-amber-300">Concerns</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {(evaluation.concerns || []).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </article>
      </div>

      <div className="rounded-2xl border border-slate-800 p-5">
        <h3 className="font-black text-white">Staff approval</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label><span className="mb-2 block text-sm font-bold text-slate-300">Adjusted score (optional)</span>
            <input type="number" min="0" max="100" value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              placeholder={`${evaluation.overallScore}`}/>
          </label>
          <label><span className="mb-2 block text-sm font-bold text-slate-300">Adjusted recommendation (optional)</span>
            <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
              <option value="">Use AI recommendation</option>
              {OPTIONS.map(([v,t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 block"><span className="mb-2 block text-sm font-bold text-slate-300">Review notes</span>
          <textarea rows="4" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            placeholder="Explain any adjustment or approval notes."/>
        </label>
        <button disabled={busy !== '' || reviewed} onClick={approve}
          className="mt-4 rounded-xl bg-brand-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {reviewed ? 'Result approved' : busy === 'approve' ? 'Approving…' : 'Approve final result'}
        </button>
      </div>
    </>}
  </section>;
}
