import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PreparationProgress from '../../components/candidate/PreparationProgress.jsx';
import { getCandidateInterview } from '../../services/candidatePortalService.js';

export default function CandidateInterviewReadyPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCandidateInterview(interviewId).then((data) => {
      setInterview(data);
      const step = data.preparation?.currentStep;
      const attemptStatus = data.preparation?.status;

      // Once an attempt has been submitted, never show "Begin interview" again.
      // PROCESSING means all answers were submitted and background processing is running.
      // COMPLETED means processing/finalization has finished.
      if (['processing', 'completed'].includes(attemptStatus) || data.status === 'completed') {
        navigate(`/candidate/interviews/${interviewId}/submitted`, { replace: true });
        return;
      }

      // An already-started attempt must resume the existing session rather than
      // offering a second start. The session endpoint will route a finished
      // attempt to the submitted page.
      if (attemptStatus === 'in_progress') {
        navigate(`/candidate/interviews/${interviewId}/session`, { replace: true });
        return;
      }

      if (step === 'consent') navigate(`/candidate/interviews/${interviewId}/consent`, { replace: true });
      else if (step === 'device_check') navigate(`/candidate/interviews/${interviewId}/device-check`, { replace: true });
      else if (step === 'instructions') navigate(`/candidate/interviews/${interviewId}/instructions`, { replace: true });
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load interview readiness.'));
  }, [interviewId, navigate]);

  if (!interview) return <Panel>{error || 'Preparing your interview…'}</Panel>;

  return (
    <div className="mx-auto max-w-4xl">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.09] via-[#0b1220] to-[#0b1220] p-7 text-center sm:p-10">
        <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300">✓</span>
          <span className="mt-6 block text-xs font-black uppercase tracking-[.2em] text-emerald-300">Preparation complete</span>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">You are ready for the interview</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">Your consent and device checks have been saved. When you begin, questions will appear one at a time and audio/video recording will start after a preparation countdown.</p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <PreparationProgress preparation={interview.preparation} compact />
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"><Info label="Questions" value={interview.questionCount} /><Info label="Timer" value={`${interview.questionTimeSeconds}s`} /><Info label="Audio" value={interview.requireAudio ? 'Required' : 'Optional'} /><Info label="Video" value={interview.requireVideo ? 'Required' : 'Optional'} /></div>
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/[.07] p-5 text-sm leading-7 text-amber-200">Starting the interview begins your attempt. Keep this browser open, remain visible on camera, and avoid switching tabs. Submitted answers cannot be changed.</div>
        <Link to={`/candidate/interviews/${interviewId}/session`} className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-black text-white hover:bg-brand-400">Begin interview</Link>
        <Link to="/candidate/dashboard" className="mt-4 inline-flex w-full items-center justify-center text-sm font-black text-brand-400">Return to dashboard</Link>
      </section>
    </div>
  );
}

function Info({ label, value }) { return <div className="rounded-2xl bg-slate-950/50 p-4 text-center"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>; }
function Panel({ children }) { return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-center text-sm font-bold text-slate-400">{children}</div>; }
