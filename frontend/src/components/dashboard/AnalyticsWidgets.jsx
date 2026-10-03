import React from 'react';

export function KpiCard({ code, label, value, note, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-500/15 text-brand-300',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-300',
    danger: 'bg-rose-500/15 text-rose-300',
    cyan: 'bg-cyan-500/15 text-cyan-300',
  };
  return <article className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5 shadow-lg shadow-black/10">
    <div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[11px] font-black ${tones[tone] || tones.brand}`}>{code}</span><div className="min-w-0"><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-black text-white">{value}</strong><small className="mt-1 block text-xs leading-5 text-slate-600">{note}</small></div></div>
  </article>;
}

export function SectionCard({ eyebrow, title, action, children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-800 bg-[#0b1220] p-5 shadow-lg shadow-black/10 ${className}`}>
    <div className="mb-5 flex items-start justify-between gap-4"><div><span className="text-[11px] font-black uppercase tracking-[.16em] text-brand-400">{eyebrow}</span><h2 className="mt-1 text-xl font-black text-white">{title}</h2></div>{action}</div>{children}
  </section>;
}

export function HorizontalBars({ items, formatter = (value) => value }) {
  const max = Math.max(1, ...items.map((item) => item.value || 0));
  return <div className="space-y-4">{items.map((item) => <div key={item.key}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="capitalize text-slate-400">{item.label || String(item.key).replaceAll('_', ' ')}</span><strong className="text-white">{formatter(item.value)}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all" style={{ width: `${Math.max(item.value ? 4 : 0, (item.value / max) * 100)}%` }} /></div></div>)}</div>;
}

export function EmptyAnalytics({ message }) {
  return <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-5 py-10 text-center text-sm text-slate-500">{message}</div>;
}
