import React, { useEffect, useState } from 'react';
import DateRangeField from '../components/DateRangeField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import {
  archiveWebsiteApplication,
  downloadWebsiteApplicationResume,
  getWebsiteApplication,
  getWebsiteApplications,
} from '../services/websiteApplicationService.js';

const statusLabels = {
  received: 'Received',
  jd_mapping_required: 'JD Mapping Required',
  ready_for_review: 'Ready for Review',
  selected_for_screening: 'Selected for Screening',
  screening: 'Screening',
  analyzed: 'Analyzed',
  archived: 'Archived',
  failed: 'Failed',
};

const statusTones = {
  received: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  jd_mapping_required: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  ready_for_review: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
  selected_for_screening: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  screening: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
  analyzed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  archived: 'border-slate-600 bg-slate-800 text-slate-400',
  failed: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function apiError(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusTones[status] || statusTones.received}`}>
      {statusLabels[status] || status}
    </span>
  );
}

export default function WebsiteApplicationsPage() {
  const { user } = useAuth();
  const canManage = [ROLES.ADMIN, ROLES.RECRUITER].includes(user?.role);

  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState({ total: 0, mappingRequired: 0, autoScreening: 0, archived: 0, analyzed: 0 });
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [filters, setFilters] = useState({ search: '', status: 'all', mappingStatus: 'all', externalJobId: '', scoreBand: 'all', fromDate: '', toDate: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionId, setActionId] = useState('');

  async function load(page = 1, nextFilters = appliedFilters) {
    setLoading(true);
    setError('');
    try {

      const data = await getWebsiteApplications({ page, limit: 10, ...nextFilters });
      setApplications(data.applications || []);
      setSummary(data.summary || {});
      setJobs(data.jobs || []);
      setPagination(data.pagination || { page, pages: 1, total: 0, limit: 10 });
    } catch (err) {
      setError(apiError(err, 'Unable to load website applications.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, appliedFilters); }, [appliedFilters]);

  function submitFilters(event) {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  }

  function resetFilters() {
    const reset = { search: '', status: 'all', mappingStatus: 'all', externalJobId: '', scoreBand: 'all', fromDate: '', toDate: '' };
    setFilters(reset);
    setAppliedFilters(reset);
  }

  async function openDetail(applicationId) {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await getWebsiteApplication(applicationId));
    } catch (err) {
      setError(apiError(err, 'Unable to load application details.'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function downloadResume(application) {
    setActionId(`resume:${application.id}`);
    setError('');
    try {
      await downloadWebsiteApplicationResume(application.id, application.resume?.filename || 'resume');
    } catch (err) {
      setError(apiError(err, 'Unable to download resume.'));
    } finally {
      setActionId('');
    }
  }

  async function archive(application) {
    if (!window.confirm(`Archive ${application.fullName}'s website application?`)) return;
    setActionId(`archive:${application.id}`);
    setError('');
    try {
      await archiveWebsiteApplication(application.id);
      if (detail?.id === application.id) setDetail(null);
      await load(pagination.page, appliedFilters);
    } catch (err) {
      setError(apiError(err, 'Unable to archive application.'));
    } finally {
      setActionId('');
    }
  }

  const cards = [
    ['Total applications', summary.total || 0],
    ['Auto screening', summary.autoScreening || 0],
    ['Analyzed', summary.analyzed || 0],
    ['JD mapping required', summary.mappingRequired || 0],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-400">Careers Integration</p>
          <h1 className="mt-2 text-3xl font-black text-white">Website Candidates</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            New website applications are automatically screened against their mapped job description. Historical applications remain unchanged.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-black text-white">{value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
        <form onSubmit={submitFilters} className="grid gap-3 lg:grid-cols-4 xl:grid-cols-6">
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search name, email, phone, job…"
            className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-brand-400"
          />
          <select value={filters.externalJobId} onChange={(e) => setFilters({ ...filters, externalJobId: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm outline-none focus:border-brand-400">
            <option value="">All Openings</option>
            {jobs.map((job) => <option key={job.externalJobId} value={job.externalJobId}>{job.title} ({job.applicationCount})</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm outline-none focus:border-brand-400">
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.scoreBand} onChange={(e) => setFilters({ ...filters, scoreBand: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm outline-none focus:border-brand-400">
            <option value="all">All AI scores</option>
            <option value="80_100">80–100%</option>
            <option value="60_79">60–79%</option>
            <option value="40_59">40–59%</option>
            <option value="0_39">Below 40%</option>
          </select>
          <DateRangeField
            fromDate={filters.fromDate}
            toDate={filters.toDate}
            label="Applied date range"
            onChange={({ fromDate, toDate }) => setFilters({ ...filters, fromDate, toDate })}
          />
          {/* <select value={filters.mappingStatus} onChange={(e) => setFilters({ ...filters, mappingStatus: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm outline-none focus:border-brand-400">
            <option value="all">All JD mappings</option>
            <option value="mapped">Mapped</option>
            <option value="mapping_required">Mapping required</option>
          </select> */}
          <div className="flex gap-2">
            <button className="rounded-xl bg-brand-500 px-4 py-3 text-sm font-black text-white hover:bg-brand-600">Apply</button>
            <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-800">Reset</button>
          </div>
        </form>

        {error && <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-3">Candidate</th>
                <th className="px-3 py-3">Applied Job</th>
                {/* <th className="px-3 py-3">TalentLens JD</th> */}
                {/* <th className="px-3 py-3">Resume</th> */}
                <th className="px-3 py-3">Applied</th>
                <th className="px-3 py-3">AI Score</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-500">Loading website applications…</td></tr>}
              {!loading && !applications.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-500">No website applications found.</td></tr>}
              {!loading && applications.map((application) => {
                return (
                  <tr key={application.id} className="hover:bg-slate-900/40">
                    <td className="px-3 py-4"><strong className="block text-white">{application.fullName}</strong><span className="mt-1 block text-xs text-slate-500">{application.email}</span>{application.phone && <span className="mt-1 block text-xs text-slate-600">{application.phone}</span>}</td>
                    <td className="px-3 py-4"><strong className="text-slate-200">{application.jobTitle}</strong><span className="mt-1 block text-xs text-slate-600">WP Job #{application.externalJobId}</span></td>
                    {/* <td className="px-3 py-4">{application.jobDescription ? <><strong className="text-slate-200">{application.jobDescription.title}</strong><span className="mt-1 block text-xs text-emerald-400">Mapped</span></> : <><span className="text-amber-300">Not mapped</span><span className="mt-1 block text-xs text-slate-600">Map this job in Job Descriptions</span></>}</td> */}
                    {/* <td className="px-3 py-4"><button type="button" disabled={actionId === `resume:${application.id}`} onClick={() => downloadResume(application)} className="font-bold text-brand-300 hover:text-brand-200 disabled:opacity-50">{actionId === `resume:${application.id}` ? 'Downloading…' : application.resume?.filename || 'View resume'}</button><span className="mt-1 block text-xs text-slate-600">{formatBytes(application.resume?.fileSize)}</span></td> */}
                    <td className="px-3 py-4 text-slate-400">{formatDate(application.appliedAt || application.receivedAt)}</td>
                    <td className="px-3 py-4">{application.analysis?.matchScore !== null && application.analysis?.matchScore !== undefined ? <><strong className="text-white">{application.analysis.matchScore}%</strong><span className="mt-1 block text-xs text-slate-600">{application.analysis.recommendation?.replaceAll('_', ' ') || ''}</span></> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-4"><StatusPill status={application.status} /></td>
                    <td className="px-3 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openDetail(application.id)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800">View</button>{application.screeningId && <a href={`/screenings/${application.screeningId}`} className="rounded-lg border border-indigo-500/30 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/10">Screening</a>}{canManage && !['selected_for_screening', 'archived', 'screening', 'analyzed'].includes(application.status) && <button type="button" disabled={actionId === `archive:${application.id}`} onClick={() => archive(application)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">Archive</button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">Showing page {pagination.page} of {pagination.pages} · {pagination.total} matching applications</span>
          <div className="flex gap-2"><button type="button" disabled={loading || pagination.page <= 1} onClick={() => load(pagination.page - 1, appliedFilters)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button type="button" disabled={loading || pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1, appliedFilters)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button></div>
        </div>
      </section>

      {(detail || detailLoading) && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4"><div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#0b1220] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5"><div><p className="text-xs font-black uppercase tracking-wider text-brand-400">Website Application</p><h2 className="mt-1 text-xl font-black text-white">{detail?.fullName || 'Loading…'}</h2></div><div className="flex shrink-0 items-center gap-2">{detail && <button type="button" disabled={actionId === `resume:${detail.id}`} onClick={() => downloadResume(detail)} className="rounded-lg border border-brand-500/30 px-4 py-2 text-xs font-black text-brand-300 hover:bg-brand-500/10 disabled:opacity-50">{actionId === `resume:${detail.id}` ? 'Downloading…' : 'Download Resume'}</button>}<button type="button" onClick={() => setDetail(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button></div></div>
        {detailLoading && !detail ? <div className="p-10 text-center text-slate-500">Loading application…</div> : detail && <div className="space-y-6 p-5">
          <div className="grid gap-4 sm:grid-cols-2"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">Email</div><div className="mt-1 text-sm text-slate-200">{detail.email}</div></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">Phone</div><div className="mt-1 text-sm text-slate-200">{detail.phone || '—'}</div></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">Applied Job</div><div className="mt-1 text-sm font-bold text-white">{detail.jobTitle}</div><div className="text-xs text-slate-600">WordPress Job #{detail.externalJobId}</div></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">TalentLens JD</div><div className="mt-1 text-sm text-slate-200">{detail.jobDescription?.title || 'Mapping required'}</div></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">Applied</div><div className="mt-1 text-sm text-slate-200">{formatDate(detail.appliedAt || detail.receivedAt)}</div></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">Status</div><div className="mt-2"><StatusPill status={detail.status} /></div></div></div>
          {detail.analysis && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="text-xs font-bold uppercase tracking-wider text-emerald-400">AI Screening Result</div><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><div className="text-xs text-slate-600">Match Score</div><div className="mt-1 text-xl font-black text-white">{detail.analysis.matchScore ?? '—'}{detail.analysis.matchScore !== null && detail.analysis.matchScore !== undefined ? '%' : ''}</div></div><div><div className="text-xs text-slate-600">Recommendation</div><div className="mt-1 text-sm font-bold capitalize text-slate-200">{detail.analysis.recommendation?.replaceAll('_', ' ') || '—'}</div></div><div><div className="text-xs text-slate-600">Current Role</div><div className="mt-1 text-sm font-bold text-slate-200">{detail.analysis.currentRole || '—'}</div></div></div></div>}
          <div><div className="text-xs font-bold uppercase tracking-wider text-slate-600">Cover Letter</div><div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">{detail.coverLetter || 'No cover letter submitted.'}</div></div>
          <div className="flex flex-wrap gap-3">
            {detail.jobUrl && <a href={detail.jobUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-bold text-brand-300 hover:text-brand-200">Open original WordPress job ↗</a>}
            {detail.screeningId && <a href={`/screenings/${detail.screeningId}`} className="inline-flex text-sm font-bold text-indigo-300 hover:text-indigo-200">Open TalentLens screening →</a>}
          </div>
        </div>}
      </div></div>}
    </div>
  );
}
