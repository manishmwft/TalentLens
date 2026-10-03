import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PreparationProgress from '../../components/candidate/PreparationProgress.jsx';
import { acceptCandidateInterviewConsent, getCandidateInterview } from '../../services/candidatePortalService.js';

const items = [
  ['recordingAccepted', 'Audio and video recording', 'Your microphone and webcam recordings will be stored for authorized hiring review.'],
  ['aiEvaluationAccepted', 'AI-assisted evaluation', 'Your answer transcripts may be evaluated by AI and reviewed by hiring staff.'],
  ['monitoringAccepted', 'Interview integrity monitoring', 'Tab changes, focus loss, inactivity, camera, microphone, and connection events may be logged.'],
  ['privacyAccepted', 'Privacy and data processing', 'You understand how your interview data is collected, processed, retained, and reviewed.'],
];

export default function CandidateConsentPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [checks, setChecks] = useState({ recordingAccepted: false, aiEvaluationAccepted: false, monitoringAccepted: false, privacyAccepted: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCandidateInterview(interviewId).then((data) => {
      setInterview(data);
      if (data.preparation?.consentComplete) navigate(`/candidate/interviews/${interviewId}/device-check`, { replace: true });
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load consent details.')).finally(() => setLoading(false));
  }, [interviewId, navigate]);

  const allAccepted = Object.values(checks).every(Boolean);

  async function submit(event) {
    event.preventDefault();
    if (!allAccepted || saving) return;
    setSaving(true); setError('');
    try {
      await acceptCandidateInterviewConsent(interviewId, { ...checks, version: '1.0' });
      navigate(`/candidate/interviews/${interviewId}/device-check`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save consent.');
    } finally { setSaving(false); }
  }

  if (loading) return <Panel>Loading consent…</Panel>;
  if (!interview) return <Panel>{error || 'Interview not found.'}</Panel>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to={`/candidate/interviews/${interviewId}`} className="text-sm font-bold text-brand-400">← Interview overview</Link>
      <section className="mt-5 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Step 1 of 3</span>
        <h1 className="mt-3 text-3xl font-black">Consent and data processing</h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">Please review and accept every item before TalentLens can access your camera or microphone.</p>
        <div className="mt-6"><PreparationProgress preparation={interview.preparation} compact /></div>
      </section>

      <form onSubmit={submit} className="mt-6 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <div className="space-y-4">
          {items.map(([key, title, description]) => (
            <label key={key} className={`flex cursor-pointer gap-4 rounded-2xl border p-5 transition ${checks[key] ? 'border-brand-500/40 bg-brand-500/[.07]' : 'border-slate-800 bg-slate-950/35 hover:border-slate-700'}`}>
              <input type="checkbox" checked={checks[key]} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} className="mt-1 h-5 w-5 accent-indigo-500" />
              <span><strong className="block text-sm">{title}</strong><span className="mt-2 block text-sm leading-6 text-slate-500">{description}</span></span>
            </label>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">AI results are advisory. Authorized hiring staff are responsible for the final hiring decision.</div>
        {error && <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <button disabled={!allAccepted || saving} className="mt-6 w-full rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-black text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving consent…' : 'Accept and continue'}</button>
      </form>
    </div>
  );
}

function Panel({ children }) { return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-center text-sm font-bold text-slate-400">{children}</div>; }
