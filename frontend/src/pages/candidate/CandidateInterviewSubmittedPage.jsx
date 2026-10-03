import React from 'react';
import { Link, useParams } from 'react-router-dom';

export default function CandidateInterviewSubmittedPage() {
  const { interviewId } = useParams();
  return (
    <div className="mx-auto max-w-3xl">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.10] via-[#0b1220] to-[#0b1220] p-8 text-center sm:p-12">
        <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative"><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-4xl text-emerald-300">✓</span><span className="mt-6 block text-xs font-black uppercase tracking-[.2em] text-emerald-300">Interview submitted</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">Thank you for completing your interview</h1><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-400">Your audio and video answers were uploaded successfully. They will be transcribed and evaluated by AI, followed by staff review.</p></div>
      </section>
      <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8"><div className="grid gap-3 sm:grid-cols-3"><Info label="Media upload" value="Completed" /><Info label="Transcription" value="Pending" /><Info label="Staff review" value="Required" /></div><div className="mt-6 rounded-2xl border border-brand-500/20 bg-brand-500/[.07] p-5 text-sm leading-7 text-brand-200">Build 5.5F will connect Google Speech-to-Text and convert each submitted audio answer into a transcript. Build 5.5G will run AI evaluation and calculate the final candidate-visible score.</div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link to="/candidate/dashboard" className="flex-1 rounded-xl bg-brand-500 px-5 py-3 text-center text-sm font-black text-white hover:bg-brand-400">Return to dashboard</Link><Link to={`/candidate/interviews/${interviewId}`} className="flex-1 rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-black text-slate-300 hover:border-slate-500">View interview status</Link></div></section>
    </div>
  );
}
function Info({ label, value }) { return <div className="rounded-2xl bg-slate-950/50 p-4 text-center"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>; }
