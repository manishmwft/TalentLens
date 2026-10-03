import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import InterviewQuestionCard from '../components/InterviewQuestionCard.jsx';
import AutomatedQuestionSetupCard from '../components/AutomatedQuestionSetupCard.jsx';
import InterviewQuestionGenerator from '../components/InterviewQuestionGenerator.jsx';
import FinalInterviewFeedback from '../components/FinalInterviewFeedback.jsx';
import AutomatedInterviewInviteModal from '../components/AutomatedInterviewInviteModal.jsx';
import AutomatedInterviewReviewPanel from '../components/AutomatedInterviewReviewPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import {
  addInterviewQuestion,
  deleteInterviewQuestion,
  generateInterviewQuestions,
  getInterview,
  reorderInterviewQuestions,
  updateInterviewQuestion,
  saveInterviewQuestionResponse,
  evaluateInterviewQuestionAnswer,
  submitInterviewFinalFeedback,
  updateInterviewStatus,
  recalculateAutomatedInterviewResult,
  retryFailedInterviewAnswers,
  approveAutomatedInterviewResult,
} from '../services/interviewService.js';

const MANAGER_ROLES = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER];
const STATUS_LABELS = { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };

function dateLabel(value) {
  if (!value) return 'Not configured';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not configured' : date.toLocaleString();
}

export default function InterviewWorkspacePage() {
  const { interviewId } = useParams();
  const { user } = useAuth();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const canManage = MANAGER_ROLES.includes(user?.role);
  const automated = interview?.deliveryMode === 'automated_ai';

  useEffect(() => {
    getInterview(interviewId)
      .then(setInterview)
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load interview workspace.'))
      .finally(() => setLoading(false));
  }, [interviewId]);

  const progress = useMemo(() => {
    const total = interview?.questions?.length || 0;
    const asked = interview?.questions?.filter((item) => item.isAsked).length || 0;
    const answered = interview?.questions?.filter((item) => String(item.candidateAnswer || '').trim()).length || 0;
    const scored = interview?.questions?.filter((item) => Number(item.interviewerScore) > 0) || [];
    const averageScore = scored.length ? (scored.reduce((sum, item) => sum + Number(item.interviewerScore || 0), 0) / scored.length).toFixed(1) : '0.0';
    return { total, asked, answered, averageScore, percentage: total ? Math.round((answered / total) * 100) : 0 };
  }, [interview]);

  async function run(action, fallback) {
    try {
      setError('');
      const updated = await action();
      setInterview(updated);
      return updated;
    } catch (requestError) {
      setError(requestError.response?.data?.message || fallback);
      throw requestError;
    }
  }

  async function generate(payload) {
    setGenerating(true);
    try {
      await run(() => generateInterviewQuestions(interviewId, payload), 'Unable to generate interview questions.');
    } finally {
      setGenerating(false);
    }
  }

  async function changeStatus(status) {
    await run(() => updateInterviewStatus(interviewId, status), 'Unable to update interview status.');
    setInterview(await getInterview(interviewId));
  }

  async function moveQuestion(questionId, direction) {
    const questions = [...interview.questions];
    const index = questions.findIndex((item) => item.id === questionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= questions.length) return;
    [questions[index], questions[target]] = [questions[target], questions[index]];
    await run(() => reorderInterviewQuestions(interviewId, questions.map((item) => item.id)), 'Unable to reorder questions.');
  }

  if (loading) return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-500">Loading interview workspace…</div>;
  if (!interview) return <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-rose-300">{error || 'Interview not found.'}</div>;

  const invitationStatus = interview.automatedConfig?.invitationStatus || 'not_created';
  const invitationSent = ['sent', 'opened', 'activated'].includes(invitationStatus);

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link to="/interviews" className="text-sm font-bold text-brand-400 hover:text-brand-300">← Back to interviews</Link>
          <span className="mt-4 block text-xs font-black uppercase tracking-[.2em] text-brand-400">{automated ? 'Automated AI interview setup' : 'Interview workspace'}</span>
          <h1 className="mt-2 text-3xl font-black text-white print:text-black">{interview.candidateName}</h1>
          <p className="mt-2 text-sm text-slate-500">{interview.candidateRole || 'Candidate'}{interview.matchScore !== null ? ` · ${interview.matchScore}% resume match` : ''}</p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300">Print questions</button>
          {automated && canManage && !invitationSent && (
            <button disabled={progress.total === 0} onClick={() => setInviteOpen(true)} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Send candidate invitation</button>
          )}
          {automated && invitationSent && <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-300">Invitation {invitationStatus}</span>}
          {!automated && interview.status === 'scheduled' && <button onClick={() => changeStatus('in_progress')} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white">Start interview</button>}
          {!automated && interview.status === 'in_progress' && <button onClick={() => changeStatus('completed')} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white">Complete interview</button>}
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

      {automated && (
        <section className={`rounded-2xl border p-5 ${invitationSent ? 'border-emerald-500/25 bg-emerald-500/[.06]' : 'border-brand-500/25 bg-brand-500/[.06]'}`}>
          <h2 className="font-black text-white">{invitationSent ? 'Candidate invitation sent' : 'Complete the interview setup in this order'}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">1. Generate questions</span><strong className={`mt-1 block ${progress.total ? 'text-emerald-300' : 'text-white'}`}>{progress.total ? `${progress.total} ready` : 'Not started'}</strong></div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">2. Review and edit</span><strong className="mt-1 block text-white">Recruiter approval</strong></div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/30 p-4"><span className="text-xs text-slate-500">3. Send invitation</span><strong className={`mt-1 block ${invitationSent ? 'text-emerald-300' : 'text-white'}`}>{invitationSent ? invitationStatus : 'Pending'}</strong></div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4"><span className="text-xs text-slate-500">Interview type</span><strong className="mt-1 block text-white">{automated ? 'Automated AI' : 'Human led'}</strong></div>
        <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4"><span className="text-xs text-slate-500">Questions</span><strong className="mt-1 block text-white">{progress.total}</strong></div>
        <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4"><span className="text-xs text-slate-500">{automated ? 'Candidate email' : 'Interviewer'}</span><strong className="mt-1 block break-all text-white">{automated ? interview.candidateEmail || 'Not available' : interview.interviewer?.name || 'Unassigned'}</strong></div>
        <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4"><span className="text-xs text-slate-500">{automated ? 'Expires' : 'Schedule'}</span><strong className="mt-1 block text-white">{automated ? dateLabel(interview.automatedConfig?.expiresAt) : dateLabel(interview.scheduledAt)}</strong></div>
      </section>

      {interview.instructions && <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5"><h2 className="text-xs font-black uppercase tracking-[.15em] text-slate-500">Interview instructions</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{interview.instructions}</p></section>}

      {canManage && !invitationSent && <InterviewQuestionGenerator hasQuestions={progress.total > 0} loading={generating} onGenerate={generate} onAddCustom={(payload) => run(() => addInterviewQuestion(interviewId, payload), 'Unable to add custom question.')} />}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div><h2 className="text-2xl font-black text-white print:text-black">{interview.questionSetTitle || 'Interview questions'}</h2><p className="mt-1 text-sm text-slate-500">{automated ? 'These are the exact questions the candidate will receive one at a time.' : 'Use the guide, record answers, and track asked questions.'}</p></div>
          <span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-black text-slate-400">{progress.total} questions</span>
        </div>

        {progress.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-10 text-center"><h3 className="text-lg font-black text-white">No question set yet</h3><p className="mt-2 text-sm text-slate-500">Generate AI questions or add custom questions, review them, then send the invitation.</p></div>
        ) : automated ? (
          interview.questions.map((question, index) => (
            <AutomatedQuestionSetupCard
              key={question.id}
              question={question}
              index={index}
              isFirst={index === 0}
              isLast={index === interview.questions.length - 1}
              onUpdate={(questionId, payload) => run(() => updateInterviewQuestion(interviewId, questionId, payload), 'Unable to update question.')}
              onDelete={(questionId) => { if (window.confirm('Delete this interview question?')) return run(() => deleteInterviewQuestion(interviewId, questionId), 'Unable to delete question.'); }}
              onMove={moveQuestion}
            />
          ))
        ) : (
          interview.questions.map((question, index) => (
            <InterviewQuestionCard
              key={question.id}
              question={question}
              index={index}
              canManage={canManage}
              isFirst={index === 0}
              isLast={index === interview.questions.length - 1}
              onUpdate={(questionId, payload) => run(() => updateInterviewQuestion(interviewId, questionId, payload), 'Unable to update question.')}
              onSaveResponse={(questionId, payload) => run(() => saveInterviewQuestionResponse(interviewId, questionId, payload), 'Unable to save answer and score.')}
              onEvaluate={(questionId, candidateAnswer) => run(() => evaluateInterviewQuestionAnswer(interviewId, questionId, candidateAnswer), 'Unable to evaluate candidate answer.')}
              onDelete={(questionId) => { if (window.confirm('Delete this interview question?')) return run(() => deleteInterviewQuestion(interviewId, questionId), 'Unable to delete question.'); }}
              onMove={moveQuestion}
            />
          ))
        )}
      </section>

      {!automated && progress.total > 0 && <FinalInterviewFeedback interview={interview} onSubmit={(payload) => run(() => submitInterviewFinalFeedback(interviewId, payload), 'Unable to submit final interview feedback.')} />}

      {automated && invitationSent && (
        <AutomatedInterviewReviewPanel
          interview={interview}
          onRecalculate={async (force) => {
            const result = await recalculateAutomatedInterviewResult(interviewId, force);
            setInterview(await getInterview(interviewId));
            return result;
          }}
          onRetryFailed={async () => {
            const result = await retryFailedInterviewAnswers(interview);
            const refreshed = await getInterview(interviewId);
            setInterview(refreshed);

            const answers = refreshed?.automatedAnswers || [];
            const allEvaluated =
              answers.length > 0 &&
              answers.every((answer) => answer?.evaluation?.status === 'completed');

            if (allEvaluated) {
              await recalculateAutomatedInterviewResult(interviewId, false);
              setInterview(await getInterview(interviewId));
              return { ...result, message: `${result.message} Final score calculated.` };
            }

            return result;
          }}
          onApprove={async (payload) => {
            const result = await approveAutomatedInterviewResult(interviewId, payload);
            setInterview(await getInterview(interviewId));
            return result;
          }}
        />
      )}

      {inviteOpen && <AutomatedInterviewInviteModal interview={interview} onClose={() => setInviteOpen(false)} onSent={async () => { setInterview(await getInterview(interviewId)); }} />}
    </div>
  );
}
