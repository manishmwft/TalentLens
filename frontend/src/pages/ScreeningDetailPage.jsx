import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CandidateComparisonModal from '../components/CandidateComparisonModal.jsx';
import ParsedCandidateCard from '../components/ParsedCandidateCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import { downloadScreeningCsv, downloadScreeningPdf, getScreening, reanalyzeScreening } from '../services/screeningService.js';

const MAX_COMPARISON_CANDIDATES = 5;

export default function ScreeningDetailPage() {
  const { screeningId } = useParams();
  const { user } = useAuth();
  const canAssignInterview = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER].includes(user?.role);
  const canManageDecision = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER].includes(user?.role);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState('');

  async function load() {
    try {
      setError('');
      setData(await getScreening(screeningId));
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load screening.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [screeningId]);

  async function handleReanalyze() {
    try {
      setReanalyzing(true);
      setError('');
      setSelectedCandidateIds([]);
      setData(await reanalyzeScreening(screeningId));
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to analyze this screening again.');
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleDownload(type) {
    try {
      setDownloading(type);
      setError('');
      if (type === 'pdf') await downloadScreeningPdf(screeningId);
      else await downloadScreeningCsv(screeningId);
    } catch (e) {
      setError(e.response?.data?.message || `Unable to download ${type.toUpperCase()} report.`);
    } finally {
      setDownloading('');
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-500">Loading screening…</div>;
  if (error && !data) return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8"><p className="mb-4 text-rose-300">{error}</p><Link className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold" to="/screenings">Back to history</Link></div>;

  const { screening, candidates } = data;
  const hasCompletedAnalysis = candidates.some((candidate) => candidate.analysisStatus === 'completed' && candidate.analysis);
  const workflowCounts = candidates.reduce((counts, candidate) => {
    const status = candidate.workflowStatus || 'new';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const selectedCandidates = selectedCandidateIds
    .map((candidateId) => candidates.find((candidate) => candidate.id === candidateId))
    .filter(Boolean);

  function handleCandidateUpdated(updatedCandidate) {
    setData((current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => candidate.id === updatedCandidate.id ? { ...candidate, ...updatedCandidate } : candidate),
    }));
  }

  function handleComparisonToggle(candidate) {
    setComparisonMessage('');
    setSelectedCandidateIds((current) => {
      if (current.includes(candidate.id)) return current.filter((candidateId) => candidateId !== candidate.id);
      if (current.length >= MAX_COMPARISON_CANDIDATES) {
        setComparisonMessage(`You can compare up to ${MAX_COMPARISON_CANDIDATES} candidates at a time.`);
        return current;
      }
      return [...current, candidate.id];
    });
  }

  function openComparison() {
    if (selectedCandidateIds.length < 2) {
      setComparisonMessage('Select at least 2 analyzed candidates to compare.');
      return;
    }
    setComparisonOpen(true);
  }

  const actionClass = 'rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">Screening report</span>
          <h1 className="mt-2 text-3xl font-black">Screening result</h1>
          <p className="mt-2 text-sm text-slate-500">{new Date(screening.createdAt).toLocaleString()} · {screening.totalCandidates} candidates</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={actionClass} to="/screenings">Back to history</Link>
          <button className={actionClass} disabled={Boolean(downloading)} onClick={() => handleDownload('csv')}>{downloading === 'csv' ? 'Preparing CSV…' : 'Export CSV'}</button>
          <button className={actionClass} disabled={Boolean(downloading) || !hasCompletedAnalysis} onClick={() => handleDownload('pdf')}>{downloading === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button>
          <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-50" disabled={reanalyzing} onClick={handleReanalyze}>{reanalyzing ? 'Analyzing again…' : 'Re-analyze'}</button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

      <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['Total', screening.totalCandidates], ['Parsed', screening.parsedCandidates], ['AI analyzed', screening.analyzedCandidates], ['AI failed', screening.failedAnalysisCandidates]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></div>)}
        </div>
        <div className="mt-6 border-t border-slate-800 pt-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Job description</h2><span className="text-xs text-slate-600">Scroll to read full JD</span></div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/35 p-4 pr-3"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-400">{screening.jobDescription}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[['New', workflowCounts.new || 0], ['Reviewing', workflowCounts.reviewing || 0], ['Shortlisted', workflowCounts.shortlisted || 0], ['Interview', workflowCounts.interview || 0], ['Rejected', workflowCounts.rejected || 0], ['Hired', workflowCounts.hired || 0]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-xl text-white">{value}</strong></div>)}
        </div>
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Ranked candidates</h2>
            <p className="mt-1 text-sm text-slate-500">Candidates are ordered by match score. Select 2–5 candidates for comparison.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={screening.analysisStatus}>AI {screening.analysisStatus.replaceAll('_', ' ')}</StatusBadge>
            {selectedCandidateIds.length > 0 && <button type="button" onClick={() => { setSelectedCandidateIds([]); setComparisonMessage(''); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white">Clear</button>}
            <button type="button" onClick={openComparison} disabled={selectedCandidateIds.length < 2} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40">Compare selected ({selectedCandidateIds.length})</button>
          </div>
        </div>

        {comparisonMessage && <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">{comparisonMessage}</div>}

        <div className="space-y-4">
          {candidates.map((candidate) => (
            <ParsedCandidateCard
              candidate={candidate}
              canAssignInterview={canAssignInterview}
              canManageDecision={canManageDecision}
              comparisonSelected={selectedCandidateIds.includes(candidate.id)}
              key={candidate.id}
              onCandidateUpdated={handleCandidateUpdated}
              onComparisonToggle={candidate.analysisStatus === 'completed' && candidate.analysis ? handleComparisonToggle : undefined}
            />
          ))}
        </div>
      </section>

      {comparisonOpen && <CandidateComparisonModal candidates={selectedCandidates} onClose={() => setComparisonOpen(false)} />}
    </div>
  );
}
