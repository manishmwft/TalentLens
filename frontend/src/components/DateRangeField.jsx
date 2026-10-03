import React from 'react';

function formatRangeDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DateRangeField({ fromDate, toDate, onChange, label = 'Date range', className = '' }) {
  const displayValue = fromDate || toDate
    ? `${fromDate ? formatRangeDate(fromDate) : 'Start'}  →  ${toDate ? formatRangeDate(toDate) : 'End'}`
    : 'Select date range';

  return (
    <details className={`group relative ${className}`}>
      <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm text-slate-200 outline-none hover:border-slate-600 group-open:border-brand-400 [&::-webkit-details-marker]:hidden">
        <span className={fromDate || toDate ? 'text-slate-200' : 'text-slate-500'}>{displayValue}</span>
        <span className="shrink-0 text-slate-500">▾</span>
      </summary>

      <div className="absolute right-0 z-30 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-[#0b1220] p-4 shadow-2xl">
        <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-bold text-slate-500">From</span>
            <input
              type="date"
              value={fromDate || ''}
              max={toDate || undefined}
              onChange={(event) => onChange?.({ fromDate: event.target.value, toDate: toDate || '' })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-400"
            />
          </label>
          <span className="pb-2 text-slate-600">→</span>
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-bold text-slate-500">To</span>
            <input
              type="date"
              value={toDate || ''}
              min={fromDate || undefined}
              onChange={(event) => onChange?.({ fromDate: fromDate || '', toDate: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-400"
            />
          </label>
        </div>
        {(fromDate || toDate) && (
          <button type="button" onClick={() => onChange?.({ fromDate: '', toDate: '' })} className="mt-3 text-xs font-bold text-brand-400 hover:text-brand-300">
            Clear date range
          </button>
        )}
      </div>
    </details>
  );
}
