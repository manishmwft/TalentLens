import React, { useRef, useState } from 'react';
import { formatFileSize, isAllowedResume, MAX_RESUME_FILES, MAX_RESUME_SIZE } from '../utils/file.js';

export default function ResumeUploader({ files, onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  function addFiles(fileList) {
    setError('');
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    if (files.length + incoming.length > MAX_RESUME_FILES) return setError(`Maximum ${MAX_RESUME_FILES} resumes allowed.`);
    const invalid = incoming.find((file) => !isAllowedResume(file));
    if (invalid) return setError(`${invalid.name} is not a PDF or DOCX file.`);
    const oversized = incoming.find((file) => file.size > MAX_RESUME_SIZE);
    if (oversized) return setError(`${oversized.name} is larger than 5 MB.`);
    const unique = incoming.filter((next) => !files.some((current) => current.name === next.name && current.size === next.size));
    onChange([...files, ...unique]);
  }

  return (
    <div>
      <input ref={inputRef} className="hidden" type="file" accept=".pdf,.docx" multiple disabled={disabled} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) addFiles(event.dataTransfer.files); }} className={`group flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-brand-500 hover:bg-brand-500/5'} disabled:opacity-50`}>
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/15 text-2xl font-black text-brand-400 transition group-hover:scale-105">↑</span>
        <strong className="text-base text-white">Drop resumes here</strong>
        <span className="mt-1 text-sm text-slate-400">or click to browse from your computer</span>
        <small className="mt-4 text-xs text-slate-600">PDF or DOCX · Maximum 5 MB each · Up to 10 files</small>
      </button>
      {error && <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      {files.length > 0 && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/30">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><strong className="text-sm">Selected resumes</strong><span className="text-xs font-bold text-slate-500">{files.length}/{MAX_RESUME_FILES}</span></div>
        <div className="divide-y divide-slate-800">{files.map((file, index) => <div className="flex items-center gap-3 px-4 py-3" key={`${file.name}-${file.size}-${index}`}><span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-[10px] font-black text-brand-400">CV</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{file.name}</strong><span className="text-xs text-slate-500">{formatFileSize(file.size)}</span></div><button type="button" disabled={disabled} onClick={() => onChange(files.filter((_file, i) => i !== index))} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10">Remove</button></div>)}</div>
      </div>}
    </div>
  );
}
