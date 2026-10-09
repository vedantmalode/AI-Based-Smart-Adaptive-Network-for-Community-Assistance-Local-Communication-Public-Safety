import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Mic, MicOff, Radio, Send, Wifi, WifiOff } from 'lucide-react';
import { fetchCommunityMessages, receiveCommunityMessage, sendCommunityMessage, subscribeToCommunityMessages, syncPendingCommunityMessages } from '../services/communityMessageApi';

export default function CommunityMessages({ userSession, isOnline }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [messageMode, setMessageMode] = useState('group');
  const [recipientId, setRecipientId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState({ state: 'idle', message: '' });
  const listRef = useRef(null);
  const canUseNativeSpeech = typeof window !== 'undefined' && Boolean(window.ResQNetNative?.startVoiceInput);

  const refreshMessages = useCallback(async () => {
    try { setMessages(await fetchCommunityMessages()); }
    catch (loadError) { setError(loadError.message || 'Could not load messages.'); }
  }, []);

  useEffect(() => {
    refreshMessages();
    const stopRealtime = subscribeToCommunityMessages((incoming) => {
      setMessages((current) => current.some((item) => item.id === incoming.id) ? current.map((item) => item.id === incoming.id ? { ...item, ...incoming } : item) : [...current, incoming]);
    });
    const poll = setInterval(refreshMessages, 8000);
    return () => { stopRealtime(); clearInterval(poll); };
  }, [refreshMessages, userSession?.id]);

  useEffect(() => {
    const onIncoming = async (event) => {
      try {
        const saved = await receiveCommunityMessage(event.detail, userSession);
        if (saved) setMessages((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? { ...item, ...saved } : item) : [...current, saved]);
      } catch (receiveError) { setError(receiveError.message || 'Could not save the relayed message.'); }
    };
    const onVoiceState = (event) => setVoiceState(event.detail || { state: 'idle', message: '' });
    const onVoiceText = (event) => {
      const recognized = String(event.detail || '').trim();
      if (recognized) setDraft((current) => `${current.trim()} ${recognized}`.trim().slice(0, 500));
    };
    window.addEventListener('resqnet:community-message', onIncoming);
    window.addEventListener('resqnet:voice-state', onVoiceState);
    window.addEventListener('resqnet:voice-text', onVoiceText);
    return () => {
      window.removeEventListener('resqnet:community-message', onIncoming);
      window.removeEventListener('resqnet:voice-state', onVoiceState);
      window.removeEventListener('resqnet:voice-text', onVoiceText);
    };
  }, [userSession]);

  useEffect(() => {
    if (isOnline) syncPendingCommunityMessages().then(refreshMessages).catch((syncError) => console.warn('Could not sync community messages:', syncError));
  }, [isOnline, userSession?.id, refreshMessages]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim() || isSending) return;
    if (messageMode === 'direct' && !recipientId.trim()) return setError('Enter the recipient account ID for a private message.');
    if (messageMode === 'direct' && recipientId.trim() === userSession?.id) return setError('Choose another account for a private message.');
    setIsSending(true);
    setError('');
    try {
      const saved = await sendCommunityMessage({ body: draft, senderName: userSession.name, originNodeId: userSession.id, recipientId: messageMode === 'direct' ? recipientId.trim() : null });
      setMessages((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? { ...item, ...saved } : item) : [...current, saved]);
      setDraft('');
      if (messageMode === 'direct') setRecipientId('');
    } catch (sendError) { setError(sendError.message || 'Could not send this message.'); }
    finally { setIsSending(false); }
  };

  const toggleVoiceInput = () => {
    if (!canUseNativeSpeech) return;
    if (voiceState.state === 'listening') window.ResQNetNative.stopVoiceInput();
    else window.ResQNetNative.startVoiceInput('en');
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-4" aria-labelledby="community-messages-title">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sky-300"><MessageCircle className="h-5 w-5" /><span className="text-[10px] font-mono font-bold uppercase tracking-widest">Response communications</span></div>
          <h1 id="community-messages-title" className="mt-1 text-2xl font-extrabold text-white">Management and volunteer messages</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Group updates are visible only to management and approved volunteers. Private messages are delivered only to the sender and selected account.</p>
        </div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-bold ${isOnline ? 'border-emerald-700/60 bg-emerald-950/60 text-emerald-200' : 'border-amber-700/60 bg-amber-950/60 text-amber-200'}`}>
          {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{isOnline ? 'Online' : 'Offline · queued'}
        </div>
      </header>

      <p className="rounded-xl border border-amber-600/30 bg-amber-950/40 p-3 text-xs text-amber-100">Messages are stored on this local server. Group messages can relay to nearby Android devices; private messages stay on this server.</p>
      {error && <p role="alert" className="rounded-lg border border-red-600/40 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}

      <div ref={listRef} className="min-h-64 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-4" aria-live="polite">
        {messages.length === 0 ? <div className="grid min-h-56 place-content-center text-center"><Radio className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-semibold text-slate-300">No messages yet</p><p className="mt-1 text-xs text-slate-500">Use this channel for non-private local safety updates.</p></div> : messages.map((message) => (
          <article key={message.id} className="max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-sky-200">{message.senderName}{message.recipientId ? ` · Private${message.senderId === userSession?.id ? ` → ${message.recipientId.slice(0, 8)}` : ''}` : ' · Group'}</strong><time className="text-[10px] text-slate-500">{new Date(message.createdAt).toLocaleString()}</time></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{message.body}</p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span>{message.deliveryState === 'SHARED' ? 'Shared' : message.deliveryState === 'RELAYED' ? `Relayed · ${message.hopCount || 0} hop(s)` : 'Stored on this device'}</span></div>
          </article>
        ))}
      </div>

      <form onSubmit={handleSend} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMessageMode('group')} aria-pressed={messageMode === 'group'} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${messageMode === 'group' ? 'border-sky-500 bg-sky-950 text-sky-100' : 'border-slate-700 text-slate-400'}`}>Responder group</button>
          <button type="button" onClick={() => setMessageMode('direct')} aria-pressed={messageMode === 'direct'} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${messageMode === 'direct' ? 'border-violet-500 bg-violet-950 text-violet-100' : 'border-slate-700 text-slate-400'}`}>Private message</button>
        </div>
        {messageMode === 'direct' && <label className="mb-2 block text-xs font-semibold text-slate-300">Recipient account ID<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="login-input mt-1" placeholder="Paste the recipient's account UUID" /></label>}
        <label className="sr-only" htmlFor="community-message-draft">{messageMode === 'direct' ? 'Private message' : 'Volunteer group message'}</label>
        <textarea id="community-message-draft" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder={messageMode === 'direct' ? 'Write a private message…' : 'Share an update with the volunteer group…'} className="w-full resize-y bg-transparent p-2 text-sm text-white outline-none placeholder:text-slate-500" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
          <span className="text-[10px] text-slate-500">{draft.length}/500 · {messageMode === 'direct' ? 'Private to sender and recipient' : 'Visible to connected group members'}</span>
          <div className="flex items-center gap-2">
            {canUseNativeSpeech && <button type="button" onClick={toggleVoiceInput} aria-label={voiceState.state === 'listening' ? 'Stop offline speech input' : 'Speak message offline'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800">
              {voiceState.state === 'listening' ? <MicOff className="h-4 w-4 text-red-300" /> : <Mic className="h-4 w-4 text-sky-300" />}{voiceState.state === 'listening' ? 'Stop voice' : 'Speak offline'}
            </button>}
            <button type="submit" disabled={!draft.trim() || isSending || !userSession} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isSending ? 'Sending…' : 'Send'}</button>
          </div>
        </div>
        {voiceState.message && <p role={voiceState.state === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${voiceState.state === 'error' ? 'text-red-300' : 'text-sky-200'}`}>{voiceState.message}</p>}
      </form>
    </section>
  );
}
