import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS, ROLES } from '../constants/roles.js';
import NotificationBell from '../components/NotificationBell.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: Object.values(ROLES) },
  { to: '/screenings/new', label: 'Screening', icon: 'plus', end: true, roles: [ROLES.ADMIN, ROLES.RECRUITER] },
  { to: '/job-descriptions', label: 'Job Descriptions', icon: 'job', end: true, roles: [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER] },
  { to: '/website-applications', label: 'Website Candidates', icon: 'applications', end: true, roles: [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER] },
  { to: '/screenings', label: 'History', icon: 'history', end: true, roles: [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER] },
  { to: '/interviews', label: 'Interviews', icon: 'interview', roles: Object.values(ROLES) },
  { to: '/team', label: 'Team & roles', icon: 'team', roles: [ROLES.ADMIN] },
  { to: '/organization', label: 'Organization', icon: 'settings', roles: [ROLES.ADMIN] },
  { to: '/profile', label: 'My profile', icon: 'profile', roles: Object.values(ROLES) },
];

function NavIcon({ type }) {
  const common = 'h-4 w-4';
  if (type === 'plus') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>;
  if (type === 'job') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === 'applications') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5M7 3v4M17 3v4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === 'history') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 3v5h5M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === 'settings') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.4a1.7 1.7 0 0 0-1.56-1.03H5v-3h.08A1.7 1.7 0 0 0 6.64 10.3 1.7 1.7 0 0 0 6.3 8.42l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.3 6a1.7 1.7 0 0 0 1.03-1.56V4h3v.08A1.7 1.7 0 0 0 15.36 5.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v3h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
  if (type === 'profile') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" /></svg>;
  if (type === 'interview') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h5" strokeLinecap="round" /></svg>;
  if (type === 'team') return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('resumeiq-sidebar-collapsed') === 'true');
  const visibleNavItems = useMemo(() => navItems.filter((item) => item.roles.includes(user?.role)), [user?.role]);

  useEffect(() => { localStorage.setItem('resumeiq-sidebar-collapsed', String(collapsed)); }, [collapsed]);

  function handleLogout() { logout(); navigate('/login', { replace: true }); }
  const sidebarWidth = collapsed ? 'lg:w-20' : 'lg:w-72';
  const contentPadding = collapsed ? 'lg:pl-20' : 'lg:pl-72';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-[#0a0f1c] p-4 transition-[width,transform] duration-300 lg:translate-x-0 ${sidebarWidth} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`mb-7 flex h-12 items-center ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 font-black text-white">T</span><div className={`${collapsed ? 'lg:hidden' : ''}`}><strong className="block text-lg">TalentLens AI</strong><span className="text-xs text-slate-500">AI recruiter workspace</span></div></div>
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close sidebar"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg></button>
        </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">{visibleNavItems.map((item) => <NavLink key={item.to} to={item.to} end={item.end} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center rounded-xl py-3 text-sm font-bold transition ${collapsed ? 'lg:justify-center lg:px-0' : 'gap-3 px-3'} ${isActive ? 'bg-brand-500 text-white shadow-lg shadow-indigo-950/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5"><NavIcon type={item.icon} /></span><span className={`${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span></NavLink>)}</nav>

        <div className="shrink-0 pt-5"><div className={`rounded-2xl border border-slate-800 bg-slate-900/70 ${collapsed ? 'lg:p-2' : 'p-4'}`}><div className={`flex items-center ${collapsed ? 'lg:justify-center' : 'gap-3'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-black">{(user?.name || 'R').slice(0, 1).toUpperCase()}</span><div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}><strong className="block truncate text-sm">{user?.name || 'User'}</strong><span className="block truncate text-xs text-slate-500">{ROLE_LABELS[user?.role] || user?.role}</span></div></div>
        {/* <NavLink to="/profile?tab=security" title={collapsed ? 'Change password' : undefined} className={`mt-3 block rounded-lg border border-slate-700 py-2 text-center text-sm font-bold text-slate-300 hover:bg-slate-800 ${collapsed ? 'lg:px-0' : 'px-3'}`}><span className={`${collapsed ? 'lg:hidden' : ''}`}>Change password</span>
        <span className={`${collapsed ? 'hidden lg:inline' : 'hidden'}`}>•••</span></NavLink> */}
        <button type="button" onClick={handleLogout} title={collapsed ? 'Logout' : undefined} className={`mt-3 rounded-lg border border-slate-700 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 ${collapsed ? 'lg:grid lg:w-full lg:place-items-center lg:px-0' : 'w-full px-3'}`}><svg className={`h-4 w-4 ${collapsed ? 'hidden lg:block' : 'hidden'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" strokeLinecap="round" strokeLinejoin="round" /></svg><span className={`${collapsed ? 'lg:hidden' : ''}`}>Logout</span></button></div></div>

        <button type="button" onClick={() => setCollapsed((value) => !value)} className="absolute -right-4 top-24 hidden h-8 w-8 place-items-center rounded-full border border-slate-700 bg-[#0a0f1c] text-slate-400 shadow-lg transition hover:border-brand-400 hover:text-white lg:grid" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/60 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <main className={`min-h-screen transition-[padding] duration-300 ${contentPadding}`}><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-[#070b14]/90 px-4 backdrop-blur md:px-8"><button type="button" className="rounded-lg border border-slate-700 p-2.5 text-slate-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open sidebar"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg></button><div className="ml-auto flex items-center gap-3"><NotificationBell /><div className="text-right"><strong className="block text-sm">{user?.organization?.name || 'ResumeIQ Workspace'}</strong><span className="text-xs text-slate-500">{ROLE_LABELS[user?.role] || 'Account'}</span></div></div></header><section className="mx-auto max-w-[1600px] p-4 md:p-8"><Outlet /></section></main>
    </div>
  );
}
