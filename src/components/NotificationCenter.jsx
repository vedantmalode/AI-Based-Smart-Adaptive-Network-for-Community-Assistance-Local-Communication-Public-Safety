import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck, Circle, ExternalLink, Radio } from 'lucide-react';

const STORAGE_KEY = 'resqnet-read-notifications';
const FILTERS = ['ALL', 'EMERGENCY', 'ASSIGNMENT', 'SYSTEM', 'SAFETY'];

function readNotificationIds() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); }
}

function notificationType(event) {
  const text = event.toLowerCase();
  if (/assign|volunteer|resource|dispatch/.test(text)) return 'ASSIGNMENT';
  if (/sync|offline|online|system|status/.test(text)) return 'SYSTEM';
  if (/safety|warning|alert/.test(text)) return 'SAFETY';
  return 'EMERGENCY';
}

export default function NotificationCenter({ incidents = [], isOnline, onOpenActivity }) {
  const [readIds, setReadIds] = useState(readNotificationIds);
  const [filter, setFilter] = useState('ALL');
  const notifications = useMemo(() => incidents.flatMap((incident) => {
    const events = incident.auditTimeline?.length ? incident.auditTimeline : [{
      event: incident.status === 'RESPONDING' ? 'Emergency response started' : `Emergency ${incident.status || 'reported'}`,
      at: incident.updatedAt || incident.reportedAt,
      by: 'AI-Based incident service',
    }];
    return events.map((entry, index) => {
      const event = entry.event || `Incident ${incident.status || 'updated'}`;
      return {
        id: `${incident.clientUuid || incident.id}-${entry.at || entry.time || index}`,
        incidentId: incident.id,
        category: notificationType(event),
        title: event,
        body: `${incident.category || 'Emergency'} · ${incident.location?.address || 'Location not provided'}`,
        at: entry.at || incident.updatedAt || incident.reportedAt,
        by: entry.by,
      };
    });
  }), [incidents]);
  const systemNotifications = !isOnline ? [{
    id: 'system-offline', category: 'SYSTEM', title: 'Offline mode is active',
    body: 'New reports are saved locally and will sync when a connection returns.', at: new Date().toISOString(),
  }] : [];
  const allNotifications = [...systemNotifications, ...notifications].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const visible = allNotifications.filter((item) => filter === 'ALL' || item.category === filter);
  const unreadCount = allNotifications.filter((item) => !readIds.has(item.id)).length;

  const markRead = (id) => {
    setReadIds((current) => {
      const next = new Set(current).add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* Read state remains available for this session. */ }
      return next;
    });
  };

  const markAllRead = () => {
    const next = new Set(allNotifications.map((item) => item.id));
    setReadIds(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* Read state remains available for this session. */ }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-10" aria-labelledby="notifications-title">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">Activity center</p><h1 id="notifications-title" className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-white sm:text-3xl"><Bell className="h-6 w-6 text-sky-300" />Notifications</h1><p className="mt-1 text-sm text-slate-400">Incident and system updates available to this session.</p></div>
        <div className="flex items-center gap-3"><span className="rounded-full bg-sky-950 px-3 py-1.5 text-xs font-bold text-sky-200">{unreadCount} unread</span><button type="button" onClick={markAllRead} disabled={!unreadCount} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40"><CheckCheck className="h-4 w-4" />Mark all read</button></div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notifications">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${filter === item ? 'border-sky-500 bg-sky-950 text-sky-100' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}`}>{item === 'ALL' ? 'All updates' : item.toLowerCase()}</button>)}</div>

      {visible.length ? <ul className="space-y-3">{visible.map((item) => {
        const isRead = readIds.has(item.id);
        return <li key={item.id} className={`rounded-2xl border p-4 transition sm:p-5 ${isRead ? 'border-slate-800 bg-slate-900/60' : 'border-sky-800/60 bg-slate-900 shadow-lg shadow-slate-950/20'}`}>
          <div className="flex items-start gap-3"><span className={`mt-1 ${isRead ? 'text-slate-600' : 'text-sky-400'}`}><Circle className="h-2.5 w-2.5 fill-current" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-300">{item.category}</span><time className="text-[10px] text-slate-500">{item.at ? new Date(item.at).toLocaleString() : 'Time unavailable'}</time></div><h2 className="mt-2 font-bold text-white">{item.title}</h2><p className="mt-1 text-sm leading-5 text-slate-400">{item.body}</p>{item.by && <p className="mt-2 text-[10px] text-slate-500">Updated by {item.by}{item.incidentId ? ` · ${item.incidentId}` : ''}</p>}</div>
            <div className="flex shrink-0 flex-col gap-2"><button type="button" onClick={() => markRead(item.id)} disabled={isRead} className="min-h-9 rounded-lg px-2 text-[10px] font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-40">{isRead ? 'Read' : 'Mark read'}</button>{item.incidentId && <button type="button" onClick={() => { markRead(item.id); onOpenActivity(item); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-sky-300 hover:bg-slate-800"><ExternalLink className="h-3 w-3" />Open</button>}</div>
          </div>
        </li>;
      })}</ul> : <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center"><Radio className="mx-auto h-8 w-8 text-slate-500" /><h2 className="mt-3 font-bold text-white">No {filter === 'ALL' ? 'notifications' : `${filter.toLowerCase()} notifications`}</h2><p className="mt-1 text-sm text-slate-400">New activity will appear here when an incident or system status changes.</p></div>}

      <p className="text-xs leading-5 text-slate-500">Push notifications are not configured in this prototype. Updates are derived from incident history and the current network state.</p>
    </main>
  );
}
