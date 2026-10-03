import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ParsedCandidateCard from '../components/ParsedCandidateCard.jsx';
import ResumeUploader from '../components/ResumeUploader.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { createScreening } from '../services/screeningService.js';
import { getJobDescriptions } from '../services/jobDescriptionService.js';

export default function NewScreeningPage() {
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [jobDescriptionId, setJobDescriptionId] = useState('');
  const [savedJDs, setSavedJDs] = useState([]);
  const [loadingJDs, setLoadingJDs] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    getJobDescriptions({ status: 'active' })
      .then(setSavedJDs)
      .catch(() => setSavedJDs([]))
      .finally(() => setLoadingJDs(false));
  }, []);

  function selectSavedJD(event) {
    const id = event.target.value;
    setJobDescriptionId(id);
    const selected = savedJDs.find((item) => item.id === id);
    if (selected) setJobDescription(selected.description);
  }

  function updateDescription(event) {
    setJobDescription(event.target.value);
    // Editing the loaded text turns this into a custom snapshot instead of claiming the saved JD was used unchanged.
    if (jobDescriptionId) setJobDescriptionId('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!files.length) return setError('Upload at least one resume.');
    if (jobDescription.trim().length < 30) return setError('Job description must contain at least 30 characters.');

    try {
      setLoading(true);
      setUploadProgress(0);
      const data = await createScreening({
        files,
        jobDescription: jobDescription.trim(),
        jobDescriptionId,
        onUploadProgress: setUploadProgress,
      });
      setResult(data);
      setFiles([]);
    } catch (requestError) {
      const isTimeout = requestError.code === 'ECONNABORTED' || String(requestError.message || '').toLowerCase().includes('timeout');
      setError(requestError.response?.data?.message || (isTimeout ? 'The analysis is taking longer than expected. Check History before submitting again.' : 'Resume analysis failed.'));
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-6"><header><span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">AI screening</span><h1 className="mt-2 text-3xl font-black">Create a new screening</h1><p className="mt-2 text-sm text-slate-500">Upload resumes and receive explainable AI match results.</p></header>
    <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5 md:p-6"><div className="grid gap-8 xl:grid-cols-2"><section><h2 className="text-lg font-black">Candidate resumes</h2><p className="mb-5 mt-1 text-sm text-slate-500">Upload PDF or DOCX files for parsing and AI analysis.</p><ResumeUploader files={files} onChange={setFiles} disabled={loading} /></section><section><div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-lg font-black">Job description</h2><p className="mt-1 text-sm text-slate-500">Select a saved JD or paste custom requirements.</p></div><span className="text-xs font-bold text-slate-600">{jobDescription.length} characters</span></div>
      <div className="mb-4"><div className="mb-2 flex items-center justify-between"><label className="text-xs font-black uppercase tracking-wider text-slate-500">Saved Job Description</label><Link to="/job-descriptions" className="text-xs font-bold text-brand-400 hover:text-brand-300">Manage JDs</Link></div><select value={jobDescriptionId} onChange={selectSavedJD} disabled={loading || loadingJDs} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-brand-400"><option value="">{loadingJDs ? 'Loading saved JDs…' : 'Select a saved JD by title (optional)'}</option>{savedJDs.map((item) => <option value={item.id} key={item.id}>{item.title}{item.department ? ` — ${item.department}` : ''}</option>)}</select>{jobDescriptionId && <p className="mt-2 text-xs text-emerald-400">Saved JD selected. Its current description will be stored as the screening snapshot.</p>}</div>
      <div className="mb-3 flex items-center gap-3"><span className="h-px flex-1 bg-slate-800" /><span className="text-[10px] font-black uppercase tracking-[.2em] text-slate-600">or paste / edit manually</span><span className="h-px flex-1 bg-slate-800" /></div>
      <textarea className="min-h-64 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950/50 p-4 text-sm leading-7 text-white placeholder:text-slate-600 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" value={jobDescription} disabled={loading} onChange={updateDescription} placeholder="Paste the job description here..." /></section></div>
      {error && <div className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
      {loading && <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex justify-between text-sm"><span>{uploadProgress < 100 ? 'Uploading resumes' : `Upload complete — analyzing ${files.length} candidate${files.length === 1 ? '' : 's'}`}</span><strong>{uploadProgress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${uploadProgress}%` }} /></div>{uploadProgress === 100 && <p className="mt-3 text-xs text-slate-500">Multiple resumes can take several minutes. Keep this page open and do not submit again.</p>}</div>}
      <div className="mt-6 flex justify-end"><button disabled={loading} className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-50">{loading ? 'Analyzing candidates…' : 'Analyze candidates'}</button></div>
    </form>
    {result && <section className="space-y-5"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-black">AI screening results</h2><p className="mt-1 text-sm text-slate-500">{result.screening.analyzedCandidates} of {result.screening.parsedCandidates} parsed resumes analyzed.</p></div><div className="flex items-center gap-3"><StatusBadge status={result.screening.analysisStatus}>AI {result.screening.analysisStatus.replaceAll('_',' ')}</StatusBadge><Link className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:bg-slate-800" to={`/screenings/${result.screening.id}`}>Open full result</Link></div></div><div className="space-y-4">{result.candidates.map((candidate) => <ParsedCandidateCard candidate={candidate} key={candidate.id} />)}</div></section>}
  </div>;
}
