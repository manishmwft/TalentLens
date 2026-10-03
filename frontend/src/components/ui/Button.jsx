import React from 'react';

const variants = {
  primary: 'bg-brand-500 text-white shadow-lg shadow-indigo-950/30 hover:bg-brand-600',
  secondary: 'border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-800',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  ghost: 'text-slate-300 hover:bg-slate-800 hover:text-white',
};

export default function Button({ as: Component = 'button', variant = 'primary', className = '', children, ...props }) {
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
