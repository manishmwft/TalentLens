import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCandidateAuth } from '../../context/CandidateAuthContext.jsx';
import { changeCandidatePassword } from '../../services/candidateAuthService.js';

export default function CandidateChangePasswordPage() {
  const { account, saveSession } = useCandidateAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!account) return <Navigate to="/candidate/login" replace />;
  if (!account.mustChangePassword) return <Navigate to="/candidate/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await changeCandidatePassword(form);
      saveSession(data);
      navigate('/candidate/dashboard', { replace: true });
    } catch (requestError) {
      const response = requestError.response?.data;
      setError(response?.errors?.[0]?.message || response?.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  }

  const field = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';

  return (
    <main className="grid min-h-screen place-items-center bg-[#070b14] px-5 py-10 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0b1220] p-7 shadow-2xl sm:p-9">
        <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Account security</span>
        <h1 className="mt-3 text-3xl font-black">Create your private password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">For security, replace the temporary password before viewing or starting your interview.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Temporary password</span><input className={field} type="password" required value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">New password</span><input className={field} type="password" minLength={8} required value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} /><small className="mt-2 block text-xs text-slate-500">Use at least 8 characters.</small></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Confirm new password</span><input className={field} type="password" minLength={8} required value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-black text-white transition hover:bg-brand-600 disabled:opacity-60">{loading ? 'Saving…' : 'Save password and continue'}</button>
        </form>
      </div>
    </main>
  );
}
