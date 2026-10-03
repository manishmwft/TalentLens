import React, { useEffect, useMemo, useState } from 'react';
import StatusBadge from './ui/StatusBadge.jsx';

function formatLabel(value) {
  return String(value || 'Not available').replaceAll('_', ' ');
}

function getCandidateName(candidate) {
  return candidate.analysis?.candidateName || candidate.originalFileName || 'Candidate';
}

function getInitials(candidate) {
  return getCandidateName(candidate)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';
}

function CandidateHeader({ candidate, isTopScore }) {
  const analysis = candidate.analysis || {};

  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${isTopScore ? 'border-emerald-500/35 bg-emerald-500/[0.06]' : 'border-slate-800 bg-slate-950/35'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-sm font-black text-brand-300">
          {getInitials(candidate)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-base font-black text-white" title={getCandidateName(candidate)}>
              {getCandidateName(candidate)}
            </h3>
            {isTopScore && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.1em] text-emerald-300">
                Top match
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500" title={analysis.currentRole || candidate.originalFileName}>
            {analysis.currentRole || candidate.originalFileName}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-3xl font-black text-white">{analysis.matchScore ?? '—'}</strong>
          <span className="ml-1 text-xs font-bold text-slate-500">/100</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge status={analysis.recommendation}>{formatLabel(analysis.recommendation)}</StatusBadge>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-300">
            {formatLabel(candidate.workflowStatus || 'new')}
          </span>
        </div>
      </div>
    </article>
  );
}

function MetricCard({ label, value, best }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${best ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-slate-800 bg-slate-950/30'}`}>
      {best && <span className="mb-1 block text-[9px] font-black uppercase tracking-[.12em] text-emerald-300">Best</span>}
      <strong className="block text-lg font-black text-white">{value}</strong>
      <span className="mt-1 block text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

function ComparisonSection({ title, candidates, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4 sm:p-5">
      <h3 className="mb-4 text-xs font-black uppercase tracking-[.16em] text-slate-400">{title}</h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(0, 1fr))` }}>
        {candidates.map((candidate, index) => (
          <div key={candidate.id} className="min-w-0">
            <p className="mb-2 truncate text-[11px] font-bold text-slate-500" title={getCandidateName(candidate)}>
              {getCandidateName(candidate)}
            </p>
            {children(candidate, index)}
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillList({ items, expanded, onToggle }) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return <p className="text-sm text-slate-600">None identified</p>;

  const visibleItems = expanded ? safeItems : safeItems.slice(0, 6);
  const hiddenCount = safeItems.length - visibleItems.length;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((item) => (
          <span key={item} className="max-w-full truncate rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300" title={item}>
            {item}
          </span>
        ))}
      </div>
      {safeItems.length > 6 && (
        <button type="button" onClick={onToggle} className="mt-2 text-xs font-black text-brand-400 hover:text-brand-300">
          {expanded ? 'Show less' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

function BulletList({ items, tone = 'default' }) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return <p className="text-sm text-slate-600">None identified</p>;

  const markerClass = tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-amber-400' : 'text-brand-400';

  return (
    <ul className="space-y-2 text-sm leading-5 text-slate-300">
      {safeItems.map((item) => (
        <li key={item} className="flex min-w-0 gap-2">
          <span className={`shrink-0 ${markerClass}`}>•</span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CandidateComparisonModal({ candidates, onClose }) {
  const [expandedSkills, setExpandedSkills] = useState({});

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const leaders = useMemo(() => {
    const completed = candidates.filter((candidate) => candidate.analysis);
    const scores = completed.map((candidate) => Number(candidate.analysis?.matchScore || 0));
    const experience = completed.map((candidate) => Number(candidate.analysis?.totalExperienceYears || 0));
    const matched = completed.map((candidate) => candidate.analysis?.matchedSkills?.length || 0);
    const missing = completed.map((candidate) => candidate.analysis?.missingSkills?.length || 0);

    return {
      maxScore: scores.length ? Math.max(...scores) : 0,
      maxExperience: experience.length ? Math.max(...experience) : 0,
      maxMatched: matched.length ? Math.max(...matched) : 0,
      minMissing: missing.length ? Math.min(...missing) : 0,
    };
  }, [candidates]);

  function toggleSkills(candidateId, type) {
    const key = `${candidateId}:${type}`;
    setExpandedSkills((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#080e1a] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 p-4 sm:p-5">
          <div className="min-w-0">
            <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Build 5.2</span>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Candidate comparison</h2>
            <p className="mt-1 text-sm text-slate-500">All selected candidates are visible together. Only vertical scrolling is used.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800 sm:px-4">
              Print
            </button>
            <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 text-xl text-slate-300 hover:bg-slate-800" aria-label="Close comparison">
              ×
            </button>
          </div>
        </header>

        <div className="overflow-y-auto overflow-x-hidden p-3 sm:p-5">
          <div className="space-y-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(0, 1fr))` }}>
              {candidates.map((candidate) => (
                <CandidateHeader
                  candidate={candidate}
                  isTopScore={Number(candidate.analysis?.matchScore || 0) === leaders.maxScore}
                  key={candidate.id}
                />
              ))}
            </div>

            <ComparisonSection title="Quick overview" candidates={candidates}>
              {(candidate) => {
                const analysis = candidate.analysis || {};
                const experience = Number(analysis.totalExperienceYears || 0);
                const matched = analysis.matchedSkills?.length || 0;
                const missing = analysis.missingSkills?.length || 0;

                return (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MetricCard label="Experience" value={`${experience} yrs`} best={experience === leaders.maxExperience} />
                    <MetricCard label="Matched" value={matched} best={matched === leaders.maxMatched} />
                    <MetricCard label="Missing" value={missing} best={missing === leaders.minMissing} />
                  </div>
                );
              }}
            </ComparisonSection>

            <ComparisonSection title="Matched skills" candidates={candidates}>
              {(candidate) => {
                const key = `${candidate.id}:matched`;
                return (
                  <SkillList
                    items={candidate.analysis?.matchedSkills}
                    expanded={Boolean(expandedSkills[key])}
                    onToggle={() => toggleSkills(candidate.id, 'matched')}
                  />
                );
              }}
            </ComparisonSection>

            <ComparisonSection title="Missing skills" candidates={candidates}>
              {(candidate) => {
                const key = `${candidate.id}:missing`;
                return (
                  <SkillList
                    items={candidate.analysis?.missingSkills}
                    expanded={Boolean(expandedSkills[key])}
                    onToggle={() => toggleSkills(candidate.id, 'missing')}
                  />
                );
              }}
            </ComparisonSection>

            <ComparisonSection title="Strengths" candidates={candidates}>
              {(candidate) => <BulletList items={candidate.analysis?.strengths} tone="positive" />}
            </ComparisonSection>

            <ComparisonSection title="Concerns" candidates={candidates}>
              {(candidate) => <BulletList items={candidate.analysis?.concerns} tone="negative" />}
            </ComparisonSection>

            <ComparisonSection title="Education" candidates={candidates}>
              {(candidate) => <SkillList items={candidate.analysis?.education} expanded />}
            </ComparisonSection>

            <ComparisonSection title="AI summary" candidates={candidates}>
              {(candidate) => (
                <p className="break-words text-sm leading-6 text-slate-400">
                  {candidate.analysis?.summary || 'Not available'}
                </p>
              )}
            </ComparisonSection>

            <ComparisonSection title="Recruiter notes" candidates={candidates}>
              {(candidate) => (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
                  {candidate.recruiterNotes || 'No recruiter notes.'}
                </p>
              )}
            </ComparisonSection>
          </div>
        </div>
      </section>
    </div>
  );
}
