import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PreparationProgress from '../../components/candidate/PreparationProgress.jsx';
import { getCandidateInterview } from '../../services/candidatePortalService.js';

function formatDate(value) {
  if (!value) return 'Not specified';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}

function nextPreparationRoute(interview) {
  const step = interview?.preparation?.currentStep;
  const attemptStatus = interview?.preparation?.status;
  if (['processing', 'completed'].includes(attemptStatus) || interview?.readinessReason === 'completed') return 'submitted';
  if (attemptStatus === 'in_progress') return 'session';
  if (step === 'device_check') return 'device-check';
  if (step === 'instructions') return 'instructions';
  if (step === 'ready') return 'ready';
  return 'consent';
}

export default function CandidateInterviewOverviewPage() {
  const { interviewId } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCandidateInterview(interviewId)
      .then(setInterview)
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load interview.'))
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) return <Panel>Loading interview…</Panel>;
  if (error) return <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>;

  const next = nextPreparationRoute(interview);
  return (
    <div>
      <Link to="/candidate/interviews" className="text-sm font-bold text-brand-400 hover:text-brand-300">← Back to interviews</Link>
      <div className="mt-5 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Automated interview</span>
        <h1 className="mt-3 text-3xl font-black">{interview.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{interview.jobDescriptionPreview}</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Questions" value={interview.questionCount || 'Pending generation'} />
          <Info label="Question timer" value={`${interview.questionTimeSeconds} seconds`} />
          <Info label="Available from" value={formatDate(interview.availableFrom)} />
          <Info label="Expires" value={formatDate(interview.expiresAt)} />
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <h2 className="text-lg font-black">Preparation progress</h2>
        <p className="mt-2 text-sm text-slate-500">Complete each required step before the first interview question is shown.</p>
        <div className="mt-5"><PreparationProgress preparation={interview.preparation} compact /></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
          <h2 className="text-lg font-black">Interview requirements</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <Requirement enabled={interview.requireAudio}>Microphone and audio recording</Requirement>
            <Requirement enabled={interview.requireVideo}>Webcam and video recording</Requirement>
            <Requirement enabled={interview.monitoring.tabAndFocus}>Tab and focus monitoring</Requirement>
            <Requirement enabled={interview.monitoring.inactivity}>Inactivity monitoring</Requirement>
            <Requirement enabled={interview.monitoring.webcam}>Webcam verification and monitoring</Requirement>
            <Requirement enabled>One recording retry per question</Requirement>
          </ul>
        </section>
        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
          <h2 className="text-lg font-black">Instructions</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-400">{interview.instructions || 'Use a quiet, well-lit room. Keep your camera and microphone enabled. Questions will be shown one at a time.'}</p>
          {!interview.canStart && <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">This interview is currently {interview.readinessReason.replaceAll('_', ' ')}.</div>}
        </section>
      </div>

      <Link
        to={`/candidate/interviews/${interview.id}/${next}`}
        className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-sm font-black ${next === 'submitted' || interview.canStart ? 'bg-brand-500 text-white hover:bg-brand-600' : 'pointer-events-none bg-slate-700 text-slate-400'}`}
      >
        {next === 'submitted' ? 'View submitted interview →' : next === 'session' ? 'Continue interview →' : 'Continue preparation →'}
      </Link>
    </div>
  );
}

function Info({ label, value }) { return <div className="rounded-2xl bg-slate-950/60 p-4"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-2 block text-sm">{value}</strong></div>; }
function Requirement({ enabled, children }) { return <li className="flex items-center gap-3"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{enabled ? '✓' : '—'}</span>{children}</li>; }
function Panel({ children }) { return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-center text-sm font-bold text-slate-400">{children}</div>; }
