import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUp, HeartPulse, Phone, RotateCcw, ShieldAlert, Stethoscope } from 'lucide-react';
import { FIRST_AID_GREETING, FIRST_AID_PROMPTS, getFirstAidResponse } from '../services/firstAidAssistant';

const makeGreeting = () => ({ id: 'greeting', role: 'assistant', text: FIRST_AID_GREETING, sources: [] });

export default function FirstAidAssistant() {
  const [messages, setMessages] = useState([makeGreeting()]);
  const [draft, setDraft] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const ask = (question) => {
    const prompt = String(question || '').trim();
    if (!prompt) return;
    const answer = getFirstAidResponse(prompt);
    const timestamp = Date.now();
    setMessages((current) => [
      ...current,
      { id: `user-${timestamp}`, role: 'user', text: prompt },
      { id: `assistant-${timestamp}`, role: 'assistant', ...answer },
    ]);
    setDraft('');
  };

  const resetChat = () => setMessages([makeGreeting()]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-10" aria-labelledby="first-aid-title">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-800/60 bg-rose-950/60 text-rose-300"><HeartPulse className="h-6 w-6" /></span>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Citizen and volunteer support</p>
              <h1 id="first-aid-title" className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">First Aid Assistant</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Ask about a common emergency or choose a topic. The assistant matches your message to a local, reviewed first-aid guide.</p>
            </div>
          </div>
          <button type="button" onClick={resetChat} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" />Clear chat</button>
        </div>
      </header>

      <section className="flex flex-col justify-between gap-3 rounded-2xl border border-red-800/60 bg-red-950/50 p-4 sm:flex-row sm:items-center" aria-label="Emergency call">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><p className="text-sm font-semibold leading-6 text-red-100">If someone is in immediate danger, unconscious, struggling to breathe, or bleeding heavily, call emergency services now.</p></div>
        <a href="tel:112" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-500"><Phone className="h-4 w-4" />Call 112</a>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70" aria-label="First aid chat">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-950/60 text-violet-300"><Stethoscope className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">First aid guide</h2><p className="text-[10px] text-slate-500">Local topic matching · no chat history is saved</p></div></div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold text-emerald-300"><Activity className="h-3 w-3" />Ready</span>
          </div>

          <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((message) => (
              <article key={message.id} className={`max-w-[92%] rounded-2xl p-4 ${message.role === 'user' ? 'ml-auto border border-blue-700/50 bg-blue-950/50 text-blue-50' : message.urgent ? 'border border-amber-700/60 bg-amber-950/35 text-amber-50' : 'border border-slate-800 bg-slate-950/70 text-slate-200'}`}>
                {message.role === 'assistant' && <p className={`mb-1 text-[10px] font-extrabold uppercase tracking-wider ${message.urgent ? 'text-amber-300' : 'text-violet-300'}`}>{message.title || 'First Aid Assistant'}</p>}
                <p className="whitespace-pre-line text-sm leading-6">{message.text}</p>
                {message.sources?.length > 0 && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-700/70 pt-2">{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-sky-300 underline decoration-sky-700 underline-offset-2 hover:text-sky-200">Source: {source.label}</a>)}</div>}
              </article>
            ))}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); ask(draft); }} className="flex items-end gap-2 border-t border-slate-800 p-3 sm:p-4">
            <label className="sr-only" htmlFor="first-aid-question">Describe the first-aid question</label>
            <textarea id="first-aid-question" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(draft); } }} placeholder="Describe what happened…" maxLength={600} className="min-h-12 flex-1 resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none" />
            <button type="submit" disabled={!draft.trim()} aria-label="Send question" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
          </form>
          <p className="px-4 pb-3 text-[10px] leading-4 text-slate-500">This guide does not diagnose, prescribe medicines, or replace emergency services. Use the source links for full instructions.</p>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4" aria-labelledby="quick-topics-title">
            <h2 id="quick-topics-title" className="text-sm font-bold text-white">Common topics</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Choose a topic to get basic steps.</p>
            <div className="mt-3 grid gap-2">{FIRST_AID_PROMPTS.map((prompt) => <button key={prompt.label} type="button" onClick={() => ask(prompt.text)} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-left text-xs font-semibold text-slate-200 transition hover:border-sky-700 hover:bg-slate-800">{prompt.label}</button>)}</div>
          </section>
          <section className="rounded-2xl border border-sky-900/60 bg-sky-950/25 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-sky-200">For volunteers</h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">Follow your current training and incident command instructions. Do not perform procedures outside your training or delay professional care.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
