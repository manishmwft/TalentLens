import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateCandidateNotes, updateCandidateWorkflowStatus } from '../services/screeningService.js';
import { formatFileSize } from '../utils/file.js';
import StatusBadge from './ui/StatusBadge.jsx';
import InterviewAssignmentModal from './InterviewAssignmentModal.jsx';
import CandidateDecisionTimeline from './CandidateDecisionTimeline.jsx';
import { createAutomatedInterviewDraft } from '../services/candidateInvitationService.js';

const WORKFLOW_OPTIONS = [
  ['new', 'New'],
  ['reviewing', 'Reviewing'],
  ['shortlisted', 'Shortlisted'],
  ['interview', 'Interview'],
  ['offer', 'Offer'],
  ['rejected', 'Rejected'],
  ['hired', 'Hired'],
];

function label(value) {
  return String(value || '').replaceAll('_', ' ');
}

function ChipList({ items, emptyText }) {
  if (!items?.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300" key={item}>{item}</span>
      ))}
    </div>
  );
}

function BulletList({ items, emptyText }) {
  if (!items?.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2.5 text-sm leading-6 text-slate-300">
      {items.map((item) => <li className="flex gap-2.5" key={item}><span className="mt-0.5 text-brand-400">•</span><span>{item}</span></li>)}
    </ul>
  );
}

export default function ParsedCandidateCard({ candidate, onCandidateUpdated, comparisonSelected = false, onComparisonToggle, canAssignInterview = false, canManageDecision = false }) {
  const [expanded, setExpanded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState(candidate.workflowStatus || 'new');
  const [notes, setNotes] = useState(candidate.recruiterNotes || '');
  const [savedNotes, setSavedNotes] = useState(candidate.recruiterNotes || '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [preparingAutomatedInterview, setPreparingAutomatedInterview] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setWorkflowStatus(candidate.workflowStatus || 'new');
    setNotes(candidate.recruiterNotes || '');
    setSavedNotes(candidate.recruiterNotes || '');
  }, [candidate.id, candidate.workflowStatus, candidate.recruiterNotes]);

  const analysis = candidate.analysis;
  const completed = candidate.analysisStatus === 'completed' && analysis;

  async function handleStatusChange(event) {
    const nextStatus = event.target.value;
    const previousStatus = workflowStatus;
    setWorkflowStatus(nextStatus);
    setSavingStatus(true);
    setActionError('');
    setMessage('');

    try {
      const updated = await updateCandidateWorkflowStatus(candidate.screeningId, candidate.id, nextStatus);
      setWorkflowStatus(updated.workflowStatus || nextStatus);
      setMessage('Status updated');
      onCandidateUpdated?.(updated);
    } catch (error) {
      setWorkflowStatus(previousStatus);
      setActionError(error.response?.data?.message || 'Unable to update candidate status.');
    } finally {
      setSavingStatus(false);
    }
  }


  async function handlePrepareAutomatedInterview() {
    setPreparingAutomatedInterview(true);
    setActionError('');
    setMessage('');

    try {
      const data = await createAutomatedInterviewDraft(candidate.screeningId, candidate.id);
      navigate(`/interviews/${data.interview.id}`);
    } catch (error) {
      setActionError(error.response?.data?.message || 'Unable to prepare the automated interview.');
    } finally {
      setPreparingAutomatedInterview(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    setActionError('');
    setMessage('');

    try {
      const updated = await updateCandidateNotes(candidate.screeningId, candidate.id, notes);
      const updatedNotes = updated.recruiterNotes || '';
      setNotes(updatedNotes);
      setSavedNotes(updatedNotes);
      setMessage('Notes saved');
      onCandidateUpdated?.(updated);
    } catch (error) {
      setActionError(error.response?.data?.message || 'Unable to save recruiter notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1220] shadow-lg shadow-black/10">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <strong className="block truncate text-base text-white">{analysis?.candidateName || candidate.originalFileName}</strong>
          <span className="mt-1 block truncate text-sm text-slate-400">{analysis?.currentRole || `${candidate.fileType?.toUpperCase()} · ${formatFileSize(candidate.fileSize)}`}</span>
          {analysis?.email && <span className="mt-1 block truncate text-xs text-slate-500">{analysis.email}{analysis.phone ? ` · ${analysis.phone}` : ''}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {completed && onComparisonToggle && (
            <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${comparisonSelected ? 'border-brand-500 bg-brand-500/10 text-brand-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-500"
                checked={comparisonSelected}
                onChange={() => onComparisonToggle(candidate)}
              />
              Compare
            </label>
          )}
          {completed && <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-brand-500/35 bg-brand-500/10 text-lg font-black text-white">{analysis.matchScore}</div>}
          <div className="flex flex-col gap-2">
            <StatusBadge status={candidate.analysisStatus}>AI {label(candidate.analysisStatus)}</StatusBadge>
            {completed && <StatusBadge status={analysis.recommendation}>{label(analysis.recommendation)}</StatusBadge>}
          </div>
          <div className="min-w-40">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-[.12em] text-slate-500" htmlFor={`workflow-${candidate.id}`}>Recruitment status</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 outline-none transition focus:border-brand-500 disabled:opacity-60"
              disabled={savingStatus}
              id={`workflow-${candidate.id}`}
              onChange={handleStatusChange}
              value={workflowStatus}
            >
              {WORKFLOW_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
          {completed && canAssignInterview && <button type="button" disabled={preparingAutomatedInterview} className="rounded-xl border border-brand-500/50 px-4 py-2.5 text-sm font-bold text-brand-300 transition hover:bg-brand-500/10 disabled:opacity-50" onClick={handlePrepareAutomatedInterview}>{preparingAutomatedInterview ? 'Opening setup…' : 'Prepare AI interview'}</button>}{completed && <button type="button" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Hide analysis' : 'View analysis'}</button>}
        </div>
      </div>

      {message && <p className="mx-5 mb-4 text-xs font-bold text-emerald-400">{message}</p>}
      {actionError && <p className="mx-5 mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{actionError}</p>}
      {candidate.parsingStatus === 'failed' && <p className="mx-5 mb-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{candidate.parsingError || 'This resume could not be parsed.'}</p>}
      {candidate.analysisStatus === 'failed' && <p className="mx-5 mb-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{candidate.analysisError || 'AI analysis failed.'}</p>}

      {completed && <div className="border-t border-slate-800 px-5 py-4 text-sm leading-6 text-slate-400"><p>{analysis.summary}</p></div>}

      {expanded && completed && (
        <div className="border-t border-slate-800 bg-[#080e1a] p-5 md:p-6">
          <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">Experience</span><strong className="mt-1 block text-lg text-white">{analysis.totalExperienceYears} years</strong></div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">Matched skills</span><strong className="mt-1 block text-lg text-white">{analysis.matchedSkills.length}</strong></div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">Missing skills</span><strong className="mt-1 block text-lg text-white">{analysis.missingSkills.length}</strong></div>
            </div>

            <div className="mt-6 grid gap-x-10 gap-y-7 lg:grid-cols-2">
              <section><h3 className="mb-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">Matched skills</h3><ChipList items={analysis.matchedSkills} emptyText="No clear matches identified." /></section>
              <section><h3 className="mb-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">Missing skills</h3><ChipList items={analysis.missingSkills} emptyText="No important missing skills identified." /></section>
              <section><h3 className="mb-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">Strengths</h3><BulletList items={analysis.strengths} emptyText="No strengths listed." /></section>
              <section><h3 className="mb-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">Concerns</h3><BulletList items={analysis.concerns} emptyText="No major concerns listed." /></section>
              <section><h3 className="mb-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">Education</h3><ChipList items={analysis.education} emptyText="Education was not identified." /></section>
              <section><h3 className="mb-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">All extracted skills</h3><ChipList items={analysis.skills} emptyText="No skills identified." /></section>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-white">Recruiter notes</h3>
                  <p className="mt-1 text-xs text-slate-500">Private notes for this candidate.</p>
                </div>
                <span className="text-xs text-slate-600">{notes.length}/5000</span>
              </div>
              <textarea
                className="min-h-32 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-brand-500"
                maxLength={5000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add interview observations, follow-up points, or hiring recommendations..."
                value={notes}
              />
              <div className="mt-3 flex justify-end">
                <button
                  className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={savingNotes || notes === savedNotes}
                  onClick={handleSaveNotes}
                  type="button"
                >
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>

            <CandidateDecisionTimeline
              candidate={candidate}
              canManage={canManageDecision}
              onCandidateUpdated={onCandidateUpdated}
            />

            <div className="mt-6 border-t border-slate-800 pt-4">
              <button type="button" className="text-sm font-bold text-brand-400 transition hover:text-brand-300" onClick={() => setShowText((value) => !value)}>{showText ? 'Hide extracted resume text' : 'Show extracted resume text'}</button>
              {showText && <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-black/30 p-4 text-xs leading-6 text-slate-400">{candidate.extractedText}</pre>}
            </div>
          </div>
        </div>
      )}
      {assignmentOpen && <InterviewAssignmentModal candidate={candidate} onClose={() => setAssignmentOpen(false)} onAssigned={() => { setMessage('Interview assigned'); onCandidateUpdated?.({ ...candidate, workflowStatus: 'interview' }); }} />}
    </article>
  );
}
