import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PreparationProgress from '../../components/candidate/PreparationProgress.jsx';
import { completeCandidatePreparation, getCandidateInterview } from '../../services/candidatePortalService.js';

export default function CandidateInterviewInstructionsPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCandidateInterview(interviewId).then((data) => {
      setInterview(data);
      if (!data.preparation?.consentComplete) navigate(`/candidate/interviews/${interviewId}/consent`, { replace: true });
      else if (!data.preparation?.deviceCheckComplete) navigate(`/candidate/interviews/${interviewId}/device-check`, { replace: true });
      else if (data.preparation?.instructionsComplete) navigate(`/candidate/interviews/${interviewId}/ready`, { replace: true });
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load interview instructions.'));
  }, [interviewId, navigate]);

  async function continueNext() {
    if (!confirmed || saving) return;
    setSaving(true); setError('');
    try {
      const result = await completeCandidatePreparation(interviewId);
      navigate(result.nextRoute || `/candidate/interviews/${interviewId}/ready`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to complete interview preparation.');
    } finally { setSaving(false); }
  }

  if (!interview) return <Panel>{error || 'Loading instructions…'}</Panel>;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={`/candidate/interviews/${interviewId}/device-check`} className="text-sm font-bold text-brand-400">← Back to device check</Link>
      <section className="mt-5 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Step 3 of 3</span>
        <h1 className="mt-3 text-3xl font-black">Final interview instructions</h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">Read these rules carefully. Once the interview begins, questions will appear one at a time.</p>
        <div className="mt-6"><PreparationProgress preparation={interview.preparation} compact /></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
          <h2 className="text-xl font-black">How the interview works</h2>
          <div className="mt-6 space-y-4">
            {[
              ['One question at a time', 'You cannot view future questions before submitting the current answer.'],
              ['Preparation and answer timer', `You receive ${interview.preparationTimeSeconds} seconds to prepare and ${interview.questionTimeSeconds} seconds to answer each question.`],
              ['Audio and video recording', 'Keep your microphone and webcam enabled throughout the interview.'],
              ['One recording retry', `You may retry each answer up to ${interview.maxRetriesPerQuestion} time.`],
              ['Monitoring', 'Tab changes, focus loss, inactivity, camera, microphone, and connection interruptions may be logged.'],
              ['Final staff review', 'AI assists with evaluation, but authorized hiring staff review the result before a decision.'],
            ].map(([title, description], index) => <div key={title} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-black text-brand-300">{index + 1}</span><div><strong className="block text-sm">{title}</strong><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div></div>)}
          </div>
          {interview.instructions && <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-5"><h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Recruiter instructions</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{interview.instructions}</p></div>}
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
            <h2 className="text-lg font-black">Interview summary</h2>
            <div className="mt-5 space-y-3"><Info label="Questions" value={interview.questionCount} /><Info label="Estimated duration" value={`${interview.durationMinutes} minutes`} /><Info label="Language" value={interview.language?.toUpperCase()} /><Info label="Maximum answer" value={`${interview.maxRecordingSeconds} seconds`} /></div>
          </section>
          <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${confirmed ? 'border-emerald-500/30 bg-emerald-500/[.06]' : 'border-slate-800 bg-[#0b1220]'}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 accent-emerald-500" /><span className="text-sm leading-6 text-slate-300">I have read the instructions and I am ready to proceed to the interview waiting screen.</span></label>
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
          <button onClick={continueNext} disabled={!confirmed || saving} className="w-full rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-black text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Preparing interview…' : 'Complete preparation'}</button>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }) { return <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-4 py-3"><span className="text-sm text-slate-500">{label}</span><strong className="text-sm">{value}</strong></div>; }
function Panel({ children }) { return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-center text-sm font-bold text-slate-400">{children}</div>; }
