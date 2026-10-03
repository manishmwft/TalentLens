import React from 'react';

const steps = [
  ['consent', 'Consent'],
  ['device_check', 'Device check'],
  ['instructions', 'Instructions'],
  ['ready', 'Ready'],
];

function completedFor(step, preparation = {}) {
  if (step === 'consent') return preparation.consentComplete;
  if (step === 'device_check') return preparation.deviceCheckComplete;
  if (step === 'instructions') return preparation.instructionsComplete;
  if (step === 'ready') return preparation.status === 'ready' || preparation.sessionStarted;
  return false;
}

export default function PreparationProgress({ preparation, compact = false }) {
  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
      {steps.map(([key, label], index) => {
        const done = completedFor(key, preparation);
        const active = preparation?.currentStep === key;
        return (
          <div
            key={key}
            className={`rounded-2xl border p-4 transition ${
              done
                ? 'border-emerald-500/25 bg-emerald-500/[.06]'
                : active
                  ? 'border-brand-500/40 bg-brand-500/[.08]'
                  : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${done ? 'bg-emerald-500/15 text-emerald-300' : active ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              {done ? '✓' : index + 1}
            </span>
            <strong className="mt-3 block text-sm">{label}</strong>
          </div>
        );
      })}
    </div>
  );
}
