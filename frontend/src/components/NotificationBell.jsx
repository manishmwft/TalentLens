import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationService.js';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 20 });
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    function outside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
    document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside);
  }, []);

  async function openItem(item) {
    if (!item.readAt) {
      await markNotificationRead(item.id);
      setUnreadCount((value) => Math.max(0, value - 1));
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function markAll() {
    await markAllNotificationsRead();
    setUnreadCount(0);
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  }

  return <div className="relative" ref={wrapperRef}>
    <button type="button" onClick={() => { setOpen((value) => !value); if (!open) load(); }} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Notifications">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-[#0b1220] shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-slate-800 p-4"><div><strong>Notifications</strong><p className="text-xs text-slate-500">{unreadCount} unread</p></div>{unreadCount > 0 && <button type="button" onClick={markAll} className="text-xs font-bold text-brand-400 hover:text-brand-300">Mark all read</button>}</div>
      <div className="max-h-96 overflow-y-auto">{loading && !items.length ? <p className="p-5 text-sm text-slate-500">Loading…</p> : !items.length ? <p className="p-5 text-sm text-slate-500">No notifications yet.</p> : items.map((item) => <button type="button" key={item.id} onClick={() => openItem(item)} className={`block w-full border-b border-slate-800 p-4 text-left transition hover:bg-slate-800/60 ${item.readAt ? '' : 'bg-brand-500/5'}`}><div className="flex gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-slate-700' : 'bg-brand-400'}`} /><div><strong className="text-sm text-slate-100">{item.title}</strong><p className="mt-1 text-xs leading-5 text-slate-400">{item.message}</p><span className="mt-2 block text-[11px] text-slate-600">{new Date(item.createdAt).toLocaleString()}</span></div></div></button>)}</div>
    </div>}
  </div>;
}
