import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboardAnalytics } from '../services/dashboardService.js';
import { EmptyAnalytics, HorizontalBars, KpiCard, SectionCard } from '../components/dashboard/AnalyticsWidgets.jsx';

const PERIODS = [
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['180d', 'Last 180 days'],
  ['all', 'All time'],
];

function label(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateTime(value) { return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }

function Funnel({ items }) {
  const max = Math.max(1, items[0]?.value || 0);
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{items.map((item, index) => {
    const width = Math.max(item.value ? 18 : 6, (item.value / max) * 100);
    return <div key={item.key} className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/35 p-4"><span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Stage {index + 1}</span><strong className="mt-2 block text-2xl font-black">{item.value}</strong><span className="text-xs text-slate-400">{item.label}</span><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} /></div></div>;
  })}</div>;
}

function TrendChart({ items }) {
  const max = Math.max(1, ...items.map((item) => item.candidates));
  return <div><div className="flex h-48 items-end gap-3 border-b border-slate-800 pb-3">{items.map((item) => <div key={item.key} className="flex h-full flex-1 flex-col justify-end gap-1"><div className="relative mx-auto flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-lg bg-slate-800" style={{ height: `${Math.max(8, (item.candidates / max) * 100)}%` }}><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-600 to-cyan-400" style={{ height: `${item.candidates ? Math.max(20, (item.analyzed / item.candidates) * 100) : 0}%` }} /></div><strong className="text-center text-xs">{item.candidates}</strong></div>)}</div><div className="mt-3 flex gap-3">{items.map((item) => <span key={item.key} className="flex-1 text-center text-[10px] font-bold text-slate-600">{item.label}</span>)}</div><div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-700" />Candidates</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-400" />AI analyzed</span></div></div>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('90d');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getDashboardAnalytics(period).then((result) => active && setAnalytics(result)).catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load recruitment analytics.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [period]);

  const kpis = useMemo(() => {
    const data = analytics?.kpis || {};
    return [
      ['SC', 'Total screenings', data.totalScreenings || 0, `${data.totalCandidates || 0} candidates uploaded`, 'brand'],
      ['AI', 'Screening success rate', `${data.analysisSuccessRate || 0}%`, `${data.analyzedCandidates || 0} candidates analyzed`, 'cyan'],
      ['RV', 'Candidates reviewed', data.reviewedCandidates || 0, `${data.shortlistedCandidates || 0} shortlisted or beyond`, 'warning'],
      ['IV', 'Interviews completed', data.interviewsCompleted || 0, `${data.scheduledInterviews || 0} currently scheduled`, 'success'],
      ['OF', 'Offers', data.offers || 0, `${data.hired || 0} candidates hired`, 'success'],
      ['RJ', 'Rejected', data.rejected || 0, 'Candidate workflow outcomes', 'danger'],
      ['RS', 'Average resume score', `${data.averageMatchScore || 0}%`, 'Across completed AI analyses', 'brand'],
      ['IS', 'Average interview score', `${data.averageInterviewScore || 0}%`, `${data.activeUsers || 0} active team members`, 'cyan'],
    ];
  }, [analytics]);

  const quickActions = [
    { to: '/screenings/new', label: 'New screening', roles: ['admin', 'recruiter'] },
    { to: '/screenings', label: 'Review candidates', roles: ['admin', 'recruiter', 'hiring_manager'] },
    { to: '/interviews', label: 'Open interviews', roles: ['admin', 'recruiter', 'hiring_manager', 'interviewer'] },
    { to: '/team', label: 'Manage team', roles: ['admin'] },
  ].filter((item) => item.roles.includes(user?.role));

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-[#0b1323] to-indigo-950/50 p-6 shadow-2xl shadow-black/20 lg:flex lg:items-end lg:justify-between lg:gap-8 lg:p-8">
      <div><span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">ATS intelligence</span><h1 className="mt-3 text-3xl font-black md:text-4xl">Recruitment analytics dashboard</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Follow candidate movement from resume upload through screening, interviews, offers, and hiring decisions.</p><div className="mt-6 flex flex-wrap gap-3">{quickActions.map((item, index) => <Link key={item.to} to={item.to} className={`rounded-xl px-5 py-3 text-sm font-black transition ${index === 0 ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800'}`}>{item.label}</Link>)}</div></div>
      <label className="mt-6 block lg:mt-0"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Analytics period</span><select value={period} onChange={(event) => setPeriod(event.target.value)} className="min-w-44 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none focus:border-brand-400">{PERIODS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    </section>

    {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
    {loading && !analytics && <div className="rounded-2xl border border-slate-800 bg-[#0b1220] py-20 text-center text-sm text-slate-500">Loading organization analytics…</div>}

    {analytics && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([code, cardLabel, value, note, tone]) => <KpiCard key={cardLabel} code={code} label={cardLabel} value={loading ? '—' : value} note={note} tone={tone} />)}</section>

      <SectionCard eyebrow="Candidate journey" title="Recruitment funnel"><Funnel items={analytics.funnel || []} /></SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Pipeline" title="Candidate status distribution"><HorizontalBars items={(analytics.candidateStatus || []).map((item) => ({ ...item, label: label(item.key) }))} /></SectionCard>
        <SectionCard eyebrow="Volume" title="Six-month screening trend"><TrendChart items={analytics.trends || []} /></SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <SectionCard eyebrow="Resume intelligence" title="AI screening quality">
          <div className="grid grid-cols-2 gap-3">{[['Average', analytics.resumeAnalytics.average], ['Median', analytics.resumeAnalytics.median], ['Highest', analytics.resumeAnalytics.highest], ['Lowest', analytics.resumeAnalytics.lowest]].map(([name, value]) => <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><span className="text-xs text-slate-500">{name}</span><strong className="mt-1 block text-2xl">{value}%</strong></div>)}</div><div className="mt-5"><HorizontalBars items={analytics.resumeAnalytics.scoreBands || []} /></div>
        </SectionCard>
        <SectionCard eyebrow="Interview intelligence" title="Interview outcomes">
          <HorizontalBars items={(analytics.interviewAnalytics.status || []).map((item) => ({ ...item, label: label(item.key) }))} /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><span className="text-xs text-slate-500">Average score</span><strong className="mt-1 block text-2xl">{analytics.interviewAnalytics.averageScore}%</strong></div><div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><span className="text-xs text-slate-500">Awaiting feedback</span><strong className="mt-1 block text-2xl">{analytics.interviewAnalytics.awaitingFeedback}</strong></div></div>
        </SectionCard>
        <SectionCard eyebrow="Decision engine" title="Hiring outcomes">
          <HorizontalBars items={(analytics.hiringAnalytics.decisions || []).map((item) => ({ ...item, label: label(item.key) }))} /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><span className="text-xs text-slate-500">Interview → offer</span><strong className="mt-1 block text-2xl">{analytics.hiringAnalytics.interviewToOfferRate}%</strong></div><div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><span className="text-xs text-slate-500">Offer → hire</span><strong className="mt-1 block text-2xl">{analytics.hiringAnalytics.offerToHireRate}%</strong></div></div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <SectionCard eyebrow="Organization activity" title="Recent candidate events" action={<Link to="/screenings" className="text-sm font-bold text-brand-400 hover:text-brand-300">Open history</Link>}>
          {!analytics.recentActivity?.length ? <EmptyAnalytics message="Candidate activity will appear after screenings, interviews, or decisions are recorded." /> : <div>{analytics.recentActivity.map((event) => <Link to={`/screenings/${event.screeningId}`} key={event.id} className="flex gap-4 border-t border-slate-800 py-4 first:border-t-0 hover:bg-white/[.02]"><span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-[10px] font-black text-brand-300">EV</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{event.title}</strong><time className="text-[10px] text-slate-600">{dateTime(event.occurredAt)}</time></div><p className="mt-1 text-xs leading-5 text-slate-500">{event.candidateName} · {event.actorName}</p>{event.description && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{event.description}</p>}</div></Link>)}</div>}
        </SectionCard>
        <SectionCard eyebrow="Team contribution" title="Active team performance">
          {!analytics.teamPerformance?.length ? <EmptyAnalytics message="Team performance appears as users create screenings, conduct interviews, and record decisions." /> : <div className="space-y-3">{analytics.teamPerformance.map((member) => <div key={member.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-sm font-black">{member.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{member.name}</strong><span className="text-[10px] uppercase tracking-wider text-slate-600">{label(member.role)}</span></div><strong className="text-brand-300">{member.activity}</strong></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><span><b className="block text-sm text-white">{member.screenings}</b>Screenings</span><span><b className="block text-sm text-white">{member.completedInterviews}</b>Interviews</span><span><b className="block text-sm text-white">{member.decisions}</b>Decisions</span></div></div>)}</div>}
        </SectionCard>
      </section>
    </>}
  </div>;
}
