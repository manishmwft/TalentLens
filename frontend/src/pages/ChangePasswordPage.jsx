import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword } from '../services/profileService.js';

const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';

export default function ChangePasswordPage() {
  const { user, updateCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); setError(''); if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; } setSaving(true); try { const updated = await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }); updateCurrentUser(updated); navigate('/dashboard', { replace: true }); } catch (err) { setError(err.response?.data?.message || 'Unable to change password.'); } finally { setSaving(false); } }
  return <div className="mx-auto max-w-xl space-y-6"><header><span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">Security</span><h1 className="mt-2 text-3xl font-black">Change password</h1><p className="mt-2 text-sm text-slate-400">{user?.mustChangePassword ? 'You must set a new password before continuing.' : 'Use a strong password you do not reuse elsewhere.'}</p></header>{error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}<form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-[#0b1220] p-6">{['currentPassword','newPassword','confirmPassword'].map((key) => <label key={key} className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{{currentPassword:'Current password',newPassword:'New password',confirmPassword:'Confirm new password'}[key]}</span><div className="relative"><input className={`${inputClass} pr-14`} type={show ? 'text' : 'password'} minLength={key === 'currentPassword' ? 1 : 8} required value={form[key]} onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))} />{key === 'newPassword' && <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-3 text-xs font-black text-slate-400 hover:text-white">{show ? 'Hide' : 'Show'}</button>}</div></label>)}<button disabled={saving} className="w-full rounded-xl bg-brand-500 px-5 py-3 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Updating…' : 'Update password'}</button></form></div>;
}
