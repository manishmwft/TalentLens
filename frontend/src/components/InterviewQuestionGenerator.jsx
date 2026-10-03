import React, { useState } from 'react';

export default function InterviewQuestionGenerator({ hasQuestions, loading, onGenerate, onAddCustom }) {
  const [category, setCategory] = useState('mixed');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [count, setCount] = useState(8);
  const [showCustom, setShowCustom] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');

  return <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">AI interview designer</span><h2 className="mt-2 text-xl font-black text-white">Question set</h2><p className="mt-1 text-sm text-slate-500">Generate questions from the resume, job description, and screening gaps.</p></div>
      <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
        <label className="text-xs font-bold text-slate-400">Category<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="mixed">Mixed</option><option value="technical">Technical</option><option value="behavioral">Behavioral</option><option value="situational">Situational</option><option value="resume_based">Resume based</option><option value="project_based">Project based</option><option value="problem_solving">Problem solving</option><option value="leadership">Leadership</option><option value="culture_fit">Culture fit</option></select></label>
        <label className="text-xs font-bold text-slate-400">Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="basic">Basic</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label className="text-xs font-bold text-slate-400">Questions<select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value={5}>5</option><option value={8}>8</option><option value={10}>10</option><option value={15}>15</option></select></label>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap gap-3"><button disabled={loading} onClick={() => onGenerate({ category, difficulty, count })} className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? 'Generating…' : hasQuestions ? 'Generate & add questions' : 'Generate AI questions'}</button><button onClick={() => setShowCustom((value) => !value)} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-300">Add custom question</button></div>
    {showCustom && <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4"><textarea value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} placeholder="Enter a custom interview question…" className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-brand-400"/><div className="mt-3 flex justify-end"><button disabled={customQuestion.trim().length < 10} onClick={async () => { await onAddCustom({ question: customQuestion.trim(), category: 'technical', difficulty: 'intermediate' }); setCustomQuestion(''); setShowCustom(false); }} className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Add question</button></div></div>}
  </section>;
}
