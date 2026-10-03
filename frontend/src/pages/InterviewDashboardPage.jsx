import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DateRangeField from '../components/DateRangeField.jsx';
import { getInterviews, updateInterviewStatus } from '../services/interviewService.js';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function invitationLabel(item) {
  const status = item.automatedConfig?.invitationStatus || 'not_created';
  if (status === 'sent') return 'Invitation sent';
  if (status === 'opened') return 'Invitation opened';
  if (status === 'activated') return 'Candidate activated';
  return item.questionCount > 0 ? 'Questions ready' : 'Draft setup';
}

function workflowStatus(item) {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'cancelled') return 'cancelled';
  if (item.status === 'in_progress') return 'in_progress';

  const expiry = validDate(item.automatedConfig?.expiresAt);
  if (expiry && expiry.getTime() < Date.now()) return 'expired';

  const invitation = item.automatedConfig?.invitationStatus || 'not_created';
  if (invitation === 'activated') return 'ready';
  if (invitation === 'opened') return 'opened';
  if (invitation === 'sent') return 'invitation_sent';
  if ((item.questionCount || 0) > 0) return 'questions_ready';
  return 'setup_required';
}

function workflowLabel(item) {
  const labels = {
    completed: 'Completed',
    cancelled: 'Cancelled',
    in_progress: 'In progress',
    expired: 'Expired',
    ready: 'Candidate activated',
    opened: 'Invitation opened',
    invitation_sent: 'Invitation sent',
    questions_ready: 'Questions ready',
    setup_required: 'Setup required',
  };
  return labels[workflowStatus(item)] || STATUS_LABELS[item.status] || 'Active';
}

export default function InterviewDashboardPage() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    getInterviews()
      .then(setInterviews)
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load interviews.'))
      .finally(() => setLoading(false));
  }, []);

  const jobOptions = useMemo(() => {
    const values = new Map();
    interviews.forEach((item) => {
      const title = String(item.jobDescriptionTitle || item.candidateRole || '').trim();
      if (!title) return;
      const key = item.jobDescriptionId || title;
      if (!values.has(key)) values.set(key, title);
    });
    return [...values.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [interviews]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return interviews.filter((item) => {
      const state = workflowStatus(item);
      const matchesTab = filter === 'all'
        || (filter === 'completed' ? state === 'completed' : !['completed', 'cancelled'].includes(state));

      const searchable = [
        item.candidateName,
        item.candidateEmail,
        item.candidateRole,
        item.jobDescriptionTitle,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || searchable.includes(query);

      const jobKey = item.jobDescriptionId || item.jobDescriptionTitle || item.candidateRole || '';
      const matchesJob = jobFilter === 'all' || String(jobKey) === String(jobFilter);
      const matchesStatus = statusFilter === 'all' || state === statusFilter;

      const score = Number(item.matchScore);
      const matchesScore = scoreFilter === 'all' || (Number.isFinite(score) && (
        scoreFilter === '80-100' ? score >= 80
          : scoreFilter === '60-79' ? score >= 60 && score < 80
            : scoreFilter === '40-59' ? score >= 40 && score < 60
              : score < 40
      ));

      const itemDate = validDate(item.createdAt || item.scheduledAt);
      const matchesDate = (!from || (itemDate && itemDate >= from)) && (!to || (itemDate && itemDate <= to));

      return matchesTab && matchesSearch && matchesJob && matchesStatus && matchesScore && matchesDate;
    });
  }, [interviews, filter, search, jobFilter, statusFilter, scoreFilter, dateFrom, dateTo]);

  async function changeStatus(id, status) {
    try {
      const updated = await updateInterviewStatus(id, status);
      setInterviews((items) => items.map((item) => item.id === id ? updated : item));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update interview status.');
    }
  }

  const inputClass = 'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white placeholder:text-slate-600 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';

  return (
    <div className="space-y-6">
      <header>
        <span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">Interview workspace</span>
        <h1 className="mt-2 text-3xl font-black">Interviews</h1>
        <p className="mt-2 text-sm text-slate-500">Review candidate interviews, monitor invitations and progress, and access completed interviews.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          // ['active', 'Active'],
          ['all', 'All'],
          ['completed', 'Completed'],
        ].map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${filter === value ? 'bg-brand-500 text-white' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{label}</button>
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(240px,1.4fr)_minmax(200px,1fr)_190px_180px_minmax(260px,1fr)]">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Search interviews</span>
            <input className={inputClass} type="search" value={search} placeholder="Candidate name or email" onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Job description</span>
            <select className={inputClass} value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
              <option value="all">All jobs</option>
              {jobOptions.map((job) => <option key={job.value} value={job.value}>{job.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Interview status</span>
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="setup_required">Setup required</option>
              <option value="questions_ready">Questions ready</option>
              <option value="invitation_sent">Invitation sent</option>
              <option value="opened">Invitation opened</option>
              <option value="ready">Candidate activated</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Match score</span>
            <select className={inputClass} value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)}>
              <option value="all">All scores</option>
              <option value="80-100">80–100%</option>
              <option value="60-79">60–79%</option>
              <option value="40-59">40–59%</option>
              <option value="0-39">Below 40%</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Date range</span>
            <DateRangeField fromDate={dateFrom} toDate={dateTo} onChange={({ fromDate, toDate }) => { setDateFrom(fromDate); setDateTo(toDate); }} />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="button" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800" onClick={() => { setSearch(''); setJobFilter('all'); setStatusFilter('all'); setScoreFilter('all'); setDateFrom(''); setDateTo(''); }}>Reset filters</button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-500">Loading interviews…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-10 text-center"><h2 className="text-lg font-black">No interviews found</h2><p className="mt-2 text-sm text-slate-500">No interviews match the selected filters.</p></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((item) => {
            const automated = item.deliveryMode === 'automated_ai';
            const schedule = validDate(item.scheduledAt);
            const expiry = validDate(item.automatedConfig?.expiresAt);
            const sent = ['sent', 'opened', 'activated'].includes(item.automatedConfig?.invitationStatus);

            return (
              <article key={item.id} className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5 shadow-lg shadow-black/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-[.14em] text-brand-400">{item.jobDescriptionTitle || item.candidateRole || 'Interview'}</span>
                    <h2 className="mt-2 text-xl font-black text-white">{item.candidateName}</h2>
                    <p className="mt-1 text-sm text-slate-500">{item.candidateRole || 'Candidate'}{item.matchScore !== null ? ` · ${item.matchScore}% match` : ''}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right">
                    <strong className="block text-sm text-white">{automated ? workflowLabel(item) : STATUS_LABELS[item.status]}</strong>
                    <span className="text-xs text-slate-500">{automated ? `${item.questionCount || 0} questions` : schedule ? schedule.toLocaleDateString() : 'Not scheduled'}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <span className="text-xs text-slate-500">{automated ? 'Candidate email' : 'Interviewer'}</span>
                    <strong className="mt-1 block break-all text-sm text-white">{automated ? item.candidateEmail || 'Not available' : item.interviewer?.name || 'Unassigned'}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <span className="text-xs text-slate-500">{automated ? 'Expiry' : 'Format'}</span>
                    <strong className="mt-1 block text-sm capitalize text-white">{automated ? expiry ? expiry.toLocaleString() : 'Set when inviting' : `${item.mode.replace('_', ' ')} · ${item.durationMinutes} min`}</strong>
                  </div>
                </div>

                {item.instructions && <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm leading-6 text-slate-400">{item.instructions}</p>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to={`/interviews/${item.id}`} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white hover:bg-brand-600">{automated ? item.questionCount > 0 ? sent ? 'View interview' : 'Review & send invitation' : 'Generate questions' : 'Open workspace'}</Link>
                  <Link to={`/screenings/${item.screeningId}`} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800">View candidate</Link>
                  {!automated && item.meetingLink && <a href={item.meetingLink} target="_blank" rel="noreferrer" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-black text-white hover:bg-brand-600">Join meeting</a>}
                  {!automated && item.status === 'scheduled' && <button onClick={() => changeStatus(item.id, 'in_progress')} className="rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/10">Start</button>}
                  {!automated && item.status === 'in_progress' && <button onClick={() => changeStatus(item.id, 'completed')} className="rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/10">Complete</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
