import React, { useEffect, useMemo, useState } from 'react';
import CandidateComparisonModal from './CandidateComparisonModal.jsx';
import DateRangeField from './DateRangeField.jsx';
import StatusBadge from './ui/StatusBadge.jsx';
import { getComparisonCandidates } from '../services/screeningService.js';

const MAX_SELECTED = 5;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function candidateName(candidate) {
  return candidate.analysis?.candidateName || candidate.originalFileName || 'Candidate';
}

export default function CrossBatchCandidateComparison({ jobs = [], onClose }) {
  const [jobId, setJobId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setSelectedIds([]);
    setCandidates([]);
    setError('');
    if (!jobId) return () => { active = false; };

    setLoading(true);
    getComparisonCandidates(jobId)
      .then((data) => { if (active) setCandidates(data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load candidates for comparison.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [jobId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    return candidates.filter((candidate) => {
      const score = Number(candidate.analysis?.matchScore);
      const applied = new Date(candidate.appliedAt || candidate.createdAt);
      const scoreMatches = scoreFilter === 'all'
        || (Number.isFinite(score) && (
          scoreFilter === '80-100' ? score >= 80
            : scoreFilter === '60-79' ? score >= 60 && score < 80
              : scoreFilter === '40-59' ? score >= 40 && score < 60
                : score < 40
        ));
      const statusMatches = statusFilter === 'all' || candidate.workflowStatus === statusFilter;
      const sourceMatches = sourceFilter === 'all' || candidate.source === sourceFilter;
      const dateMatches = (!from || applied >= from) && (!to || applied <= to);
      const searchable = [candidateName(candidate), candidate.analysis?.email, candidate.analysis?.phone, candidate.originalFileName]
        .filter(Boolean).join(' ').toLowerCase();
      return scoreMatches && statusMatches && sourceMatches && dateMatches && (!query || searchable.includes(query));
    });
  }, [candidates, search, scoreFilter, statusFilter, sourceFilter, fromDate, toDate]);

  const selectedCandidates = candidates.filter((candidate) => selectedIds.includes(candidate.id));

  function toggle(candidateId) {
    setError('');
    setSelectedIds((current) => {
      if (current.includes(candidateId)) return current.filter((id) => id !== candidateId);
      if (current.length >= MAX_SELECTED) {
        setError(`Select up to ${MAX_SELECTED} candidates for one comparison.`);
        return current;
      }
      return [...current, candidateId];
    });
  }

  function resetFilters() {
    setSearch(''); setScoreFilter('all'); setStatusFilter('all'); setSourceFilter('all'); setFromDate(''); setToDate('');
  }

  const inputClass = 'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white placeholder:text-slate-600 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';

  return (
    <section className="space-y-4 rounded-2xl border border-brand-500/25 bg-[#0b1220] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Cross-batch comparison</span>
          <h2 className="mt-1 text-2xl font-black">Compare candidates</h2>
          <p className="mt-1 text-sm text-slate-500">Choose one JD, then compare 2–5 analyzed candidates from any date or screening source.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800">Close comparison</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(230px,1.15fr)_minmax(230px,1.25fr)_170px_170px_170px_minmax(250px,1fr)]">
        <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Job description *</span><select className={inputClass} value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">Select a job</option>{jobs.filter((job) => job.id).map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}</select></label>
        <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Search candidate</span><input className={inputClass} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone..." disabled={!jobId} /></label>
        <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">AI score</span><select className={inputClass} value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)} disabled={!jobId}><option value="all">All scores</option><option value="80-100">80–100%</option><option value="60-79">60–79%</option><option value="40-59">40–59%</option><option value="0-39">Below 40%</option></select></label>
        {/* <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Status</span><select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} disabled={!jobId}><option value="all">All statuses</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="shortlisted">Shortlisted</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="rejected">Rejected</option><option value="hired">Hired</option></select></label> */}
        <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Source</span><select className={inputClass} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} disabled={!jobId}><option value="all">All sources</option><option value="website">Website</option><option value="manual">Manual upload</option></select></label>
        <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Applied date</span><DateRangeField fromDate={fromDate} toDate={toDate} disabled={!jobId} onChange={({ fromDate: nextFrom, toDate: nextTo }) => { setFromDate(nextFrom); setToDate(nextTo); }} /></label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500"><strong className="text-lg text-white">{selectedIds.length}</strong> / {MAX_SELECTED} selected</div>
        <div className="flex gap-2"><button type="button" onClick={resetFilters} disabled={!jobId} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40">Reset filters</button><button type="button" onClick={() => setComparisonOpen(true)} disabled={selectedIds.length < 2} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-black text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40">Compare selected ({selectedIds.length})</button></div>
      </div>

      {error && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</div>}
      {!jobId && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Select a Job Description to load analyzed candidates across all screening dates.</div>}
      {jobId && loading && <div className="p-8 text-center text-sm text-slate-500">Loading candidates…</div>}
      {jobId && !loading && !filtered.length && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">No analyzed candidates match these filters.</div>}
      {jobId && !loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="w-12 p-4" /><th className="p-4">Candidate</th><th className="p-4">Applied</th><th className="p-4">Source</th><th className="p-4">AI score</th><th className="p-4">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{filtered.map((candidate) => { const selected = selectedIds.includes(candidate.id); return <tr key={candidate.id} className={selected ? 'bg-brand-500/[.08]' : 'hover:bg-white/[.02]'}><td className="p-4 text-center"><input type="checkbox" className="h-4 w-4 accent-indigo-500" checked={selected} onChange={() => toggle(candidate.id)} /></td><td className="p-4"><strong className="block text-sm text-white">{candidateName(candidate)}</strong><span className="text-xs text-slate-500">{candidate.analysis?.email || candidate.originalFileName}</span></td><td className="p-4 text-sm text-slate-400">{formatDate(candidate.appliedAt || candidate.createdAt)}</td><td className="p-4 text-sm capitalize text-slate-400">{candidate.source === 'website' ? 'Website' : 'Manual upload'}</td><td className="p-4"><span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black text-white">{candidate.analysis?.matchScore ?? '—'}%</span></td><td className="p-4"><StatusBadge status={candidate.workflowStatus}>{String(candidate.workflowStatus || 'new').replaceAll('_', ' ')}</StatusBadge></td></tr>; })}</tbody>
          </table>
        </div>
      )}

      {comparisonOpen && <CandidateComparisonModal candidates={selectedCandidates} onClose={() => setComparisonOpen(false)} />}
    </section>
  );
}
