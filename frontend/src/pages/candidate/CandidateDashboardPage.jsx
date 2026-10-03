import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PreparationProgress from '../../components/candidate/PreparationProgress.jsx';
import { useCandidateAuth } from '../../context/CandidateAuthContext.jsx';
import { getCandidateInterviews } from '../../services/candidatePortalService.js';

function dt(value) {
  return value
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Not specified';
}

const readinessCopy = {
  ready: 'Ready to begin',
  not_available: 'Opens later',
  expired: 'Expired',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function actionFor(interview) {
  const step = interview.preparation?.currentStep;
  const attemptStatus = interview.preparation?.status;

  if (['processing', 'completed'].includes(attemptStatus) || interview.readinessReason === 'completed') {
    return { label: 'View submitted interview', path: 'submitted' };
  }
  if (attemptStatus === 'in_progress') return { label: 'Continue interview', path: 'session' };
  if (step === 'device_check') return { label: 'Continue device check', path: 'device-check' };
  if (step === 'instructions') return { label: 'Review instructions', path: 'instructions' };
  if (step === 'ready') return { label: 'Open interview readiness', path: 'ready' };
  return { label: 'Start preparation', path: 'consent' };
}

export default function CandidateDashboardPage() {
  const { account } = useCandidateAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCandidateInterviews()
      .then(setItems)
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load interviews.'))
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => items.find((item) => !['completed', 'cancelled'].includes(item.readinessReason)) || items[0], [items]);
  const completed = items.filter((item) => item.readinessReason === 'completed').length;
  const ready = items.filter((item) => item.canStart).length;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#101a31] via-[#0b1220] to-[#0b1220] p-7 sm:p-9">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">Candidate workspace</span>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Welcome, {account?.profile?.fullName || 'Candidate'} 👋</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Complete your preparation checks before entering the automated interview.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Ready now" value={ready} />
            <Stat label="Total interviews" value={items.length} />
            <Stat label="Completed" value={completed} />
          </div>
        </div>
      </section>

      {loading && <Panel>Loading your candidate workspace…</Panel>}
      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">{error}</div>}
      {!loading && !error && !active && <Panel><h2 className="text-xl font-black">No interview invitations yet</h2><p className="mt-2 text-sm text-slate-500">Your recruiter will notify you when an interview is ready.</p></Panel>}

      {active && (() => {
        const action = actionFor(active);
        return (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
            <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-300">Current interview</span>
                  <h2 className="mt-4 text-2xl font-black">{active.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">Complete before {dt(active.expiresAt)}</p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${active.canStart ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                  {readinessCopy[active.readinessReason] || active.status}
                </span>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Mini label="Questions" value={active.questionCount || 'Pending'} />
                <Mini label="Duration" value={`${active.durationMinutes} min`} />
                <Mini label="Audio" value={active.requireAudio ? 'Required' : 'Optional'} />
                <Mini label="Video" value={active.requireVideo ? 'Required' : 'Optional'} />
              </div>

              <div className="mt-7">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Preparation progress</h3>
                <div className="mt-4"><PreparationProgress preparation={active.preparation} /></div>
              </div>

              <Link
                to={`/candidate/interviews/${active.id}/${action.path}`}
                className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-brand-600"
              >
                {action.label} →
              </Link>
            </section>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
                <h2 className="text-lg font-black">Before you begin</h2>
                <ul className="mt-5 space-y-4 text-sm text-slate-400">
                  {['Use a quiet and well-lit room', 'Keep a stable internet connection', 'Allow camera and microphone access', 'Do not switch tabs during the interview'].map((item) => <li key={item} className="flex gap-3"><span className="mt-0.5 text-emerald-400">✓</span>{item}</li>)}
                </ul>
              </section>
              <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
                <h2 className="text-lg font-black">Account</h2>
                <p className="mt-3 text-sm text-slate-500">{account?.email}</p>
                <Link to="/candidate/profile" className="mt-4 inline-flex text-sm font-black text-brand-400">Review profile →</Link>
              </section>
            </aside>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value }) { return <div className="min-w-[110px] rounded-2xl border border-slate-700/70 bg-black/10 p-4"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></div>; }
function Mini({ label, value }) { return <div className="rounded-2xl bg-slate-950/60 p-4"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>; }
function Panel({ children }) { return <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8 text-center text-slate-400">{children}</div>; }
