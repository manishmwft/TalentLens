import React from 'react';

const tones = {
  completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  partially_completed: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  processing: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  pending: 'border-slate-600 bg-slate-800 text-slate-300',
  failed: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  strong_match: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  possible_match: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  not_recommended: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
};

export default function StatusBadge({ status, children }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold capitalize ${tones[status] || tones.pending}`}>{children}</span>;
}
