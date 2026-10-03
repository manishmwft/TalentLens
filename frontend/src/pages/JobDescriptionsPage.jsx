import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import {
  archiveJobDescription,
  compareJobDescriptions,
  createJobDescription,
  getJobDescriptions,
  updateJobDescription,
} from '../services/jobDescriptionService.js';

const emptyForm = {
  title: '',
  department: '',
  location: '',
  employmentType: '',
  experienceLevel: '',
  description: '',
  status: 'active',
};

function StatusPill({ status }) {
  const classes = status === 'active'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : status === 'draft'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-slate-600 bg-slate-800 text-slate-400';
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-black capitalize ${classes}`}>{status}</span>;
}

export default function JobDescriptionsPage() {
  const { user } = useAuth();
  const canManage = [ROLES.ADMIN, ROLES.RECRUITER].includes(user?.role);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const data = await getJobDescriptions({ status });
      setItems(data);
      setSelectedIds((ids) => ids.filter((id) => data.some((item) => item.id === id)));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load job descriptions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [item.title, item.department, item.location, item.employmentType]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      title: item.title || '',
      department: item.department || '',
      location: item.location || '',
      employmentType: item.employmentType || '',
      experienceLevel: item.experienceLevel || '',
      description: item.description || '',
      status: item.status || 'active',
    });
    setShowForm(true);
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    if (form.title.trim().length < 2) return setError('Enter a job title.');
    if (form.description.trim().length < 30) return setError('Job description must contain at least 30 characters.');

    try {
      setSaving(true);
      const payload = { ...form, title: form.title.trim(), description: form.description.trim() };
      if (editing) await updateJobDescription(editing.id, payload);
      else await createJobDescription(payload);
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save job description.');
    } finally {
      setSaving(false);
    }
  }

  async function archive(item) {
    if (!window.confirm(`Archive “${item.title}”? Existing screening history will remain unchanged.`)) return;
    try {
      setError('');
      await archiveJobDescription(item.id);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not archive job description.');
    }
  }

  function toggleSelected(id) {
    setComparison(null);
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length < 4 ? [...current, id] : current);
  }

  async function compareSelected() {
    if (selectedIds.length < 2) return setError('Select at least two job descriptions to compare.');
    try {
      setError('');
      setComparison(await compareJobDescriptions(selectedIds));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not compare job descriptions.');
    }
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">Hiring library</span><h1 className="mt-2 text-3xl font-black">Job Descriptions</h1><p className="mt-2 text-sm text-slate-500">Create, reuse and compare organization job descriptions.</p></div>
      {canManage && <button type="button" onClick={openCreate} className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-black text-white hover:bg-brand-600">+ Add Job Description</button>}
    </header>

    <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, department or location..." className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none focus:border-brand-400 sm:max-w-md" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none focus:border-brand-400"><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
        </div>
        {/* <button type="button" disabled={selectedIds.length < 2} onClick={compareSelected} className="rounded-xl border border-brand-500/50 px-4 py-2.5 text-sm font-black text-brand-300 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-40">Compare selected ({selectedIds.length}/4)</button> */}
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500"><tr>
            {/* <th className="px-3 py-3">Compare</th> */}
            <th className="px-3 py-3">Title</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {loading && <tr><td colSpan="8" className="px-3 py-10 text-center text-slate-500">Loading job descriptions…</td></tr>}
            {!loading && !filteredItems.length && <tr><td colSpan="8" className="px-3 py-10 text-center text-slate-500">No job descriptions found.</td></tr>}
            {!loading && filteredItems.map((item) => <tr key={item.id} className="hover:bg-slate-900/40">
              {/* <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.includes(item.id)} disabled={!selectedIds.includes(item.id) && selectedIds.length >= 4} onChange={() => toggleSelected(item.id)} className="h-4 w-4 accent-indigo-500" /></td> */}
              <td className="px-3 py-4"><strong className="block text-white">{item.title}</strong><span className="mt-1 block max-w-xs truncate text-xs text-slate-500">{item.experienceLevel || 'Experience not specified'}</span></td>
              <td className="px-3 py-4 text-slate-300">{item.department || '—'}</td><td className="px-3 py-4 text-slate-300">{item.employmentType || '—'}</td><td className="px-3 py-4 text-slate-300">{item.location || '—'}</td><td className="px-3 py-4"><StatusPill status={item.status} /></td><td className="px-3 py-4 text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</td>
              <td className="px-3 py-4"><div className="flex justify-end gap-2">{canManage && <button type="button" onClick={() => openEdit(item)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800">Edit</button>}{canManage && item.status !== 'archived' && <button type="button" onClick={() => archive(item)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10">Archive</button>}</div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {comparison && <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">JD comparison</h2><p className="mt-1 text-sm text-slate-500">Side-by-side view of the selected job descriptions.</p></div><button type="button" onClick={() => setComparison(null)} className="text-sm font-bold text-slate-400 hover:text-white">Close</button></div>
      {!!comparison.commonKeywords?.length && <div className="mt-4"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Common keywords</span><div className="mt-2 flex flex-wrap gap-2">{comparison.commonKeywords.map((word) => <span key={word} className="rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-300">{word}</span>)}</div></div>}
      <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">{comparison.jobDescriptions.map((item) => <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-black">{item.title}</h3><StatusPill status={item.status} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-600">Department</dt><dd className="mt-1 text-slate-300">{item.department || '—'}</dd></div><div><dt className="text-slate-600">Experience</dt><dd className="mt-1 text-slate-300">{item.experienceLevel || '—'}</dd></div><div><dt className="text-slate-600">Type</dt><dd className="mt-1 text-slate-300">{item.employmentType || '—'}</dd></div><div><dt className="text-slate-600">Location</dt><dd className="mt-1 text-slate-300">{item.location || '—'}</dd></div></dl><div className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap border-t border-slate-800 pt-4 text-sm leading-6 text-slate-400">{item.description}</div></article>)}</div>
    </section>}

    {showForm && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4"><div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#0b1220] shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 p-5"><div><h2 className="text-xl font-black">{editing ? 'Edit Job Description' : 'Add Job Description'}</h2><p className="mt-1 text-xs text-slate-500">Admin and Recruiter can manage organization JDs.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button></div>
      <form onSubmit={save} className="space-y-5 p-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Job title *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal outline-none focus:border-brand-400" /></label><label className="text-sm font-bold">Department<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal outline-none focus:border-brand-400" /></label><label className="text-sm font-bold">Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal outline-none focus:border-brand-400" /></label><label className="text-sm font-bold">Employment type<input value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} placeholder="Full Time / Contract / Remote" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal outline-none focus:border-brand-400" /></label><label className="text-sm font-bold">Experience level<input value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })} placeholder="e.g. 3–5 years / Senior" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal outline-none focus:border-brand-400" /></label><label className="text-sm font-bold">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal outline-none focus:border-brand-400"><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label></div>
        <label className="block text-sm font-bold">Job description *<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-2 min-h-72 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/50 p-4 font-normal leading-6 outline-none focus:border-brand-400" placeholder="Paste the complete role requirements..." /><span className="mt-1 block text-right text-xs font-normal text-slate-600">{form.description.length} characters</span></label>
        <div className="flex justify-end gap-3 border-t border-slate-800 pt-5"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-bold hover:bg-slate-800">Cancel</button><button disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Save JD'}</button></div>
      </form></div></div>}
  </div>;
}
