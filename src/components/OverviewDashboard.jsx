import React, { useMemo, useState } from 'react';
import { AlertOctagon, MapPinned, ShieldAlert, Truck, Users } from 'lucide-react';
import GISMapView from './GISMapView';

export default function OverviewDashboard({ incidents, volunteers, resources, isOnline, lastSyncedAt, onOpenMap, onCreateIncident }) {
  const [rangeDays, setRangeDays] = useState(7);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [areaFilter, setAreaFilter] = useState('');
  const rangeStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - rangeDays + 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [rangeDays]);
  const scopedIncidents = incidents.filter((incident) => {
    const reportedAt = new Date(incident.reportedAt || 0);
    return reportedAt >= rangeStart
      && (categoryFilter === 'ALL' || incident.category === categoryFilter)
      && (statusFilter === 'ALL' || incident.status === statusFilter)
      && (!areaFilter.trim() || (incident.location?.address || '').toLowerCase().includes(areaFilter.trim().toLowerCase()));
  });
  const openIncidents = scopedIncidents.filter((incident) => !['RESOLVED', 'REJECTED'].includes(incident.status));
  const criticalIncidents = openIncidents.filter((incident) => incident.severity === 'CRITICAL');
  const availableVolunteers = volunteers.filter((volunteer) => volunteer.status === 'ACTIVE');
  const availableResources = resources.filter((resource) => resource.status === 'AVAILABLE');
  const respondingDurations = scopedIncidents
    .filter((incident) => incident.reportedAt && incident.lifecycle?.respondingAt)
    .map((incident) => (new Date(incident.lifecycle.respondingAt) - new Date(incident.reportedAt)) / 60000)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  const averageResponseMinutes = respondingDurations.length
    ? respondingDurations.reduce((total, minutes) => total + minutes, 0) / respondingDurations.length
    : null;
  const dailyCounts = Array.from({ length: rangeDays }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (rangeDays - offset - 1));
    date.setHours(0, 0, 0, 0);
    const key = date.toLocaleDateString();
    return {
      key,
      label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      count: scopedIncidents.filter((incident) => new Date(incident.reportedAt || 0).toLocaleDateString() === key).length,
    };
  });
  const maxDailyCount = Math.max(1, ...dailyCounts.map((item) => item.count));
  const severityCounts = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => ({
    severity,
    count: scopedIncidents.filter((incident) => incident.severity === severity).length,
  }));
  const maxSeverityCount = Math.max(1, ...severityCounts.map((item) => item.count));
  const categories = [...new Set(incidents.map((incident) => incident.category).filter(Boolean))].sort();

  const metrics = [
    { label: 'Critical incidents', value: criticalIncidents.length, detail: 'Open and requiring urgent attention', icon: AlertOctagon, color: 'text-red-400', border: 'border-red-500/60' },
    { label: 'Active emergencies', value: openIncidents.length, detail: 'Not resolved or rejected', icon: ShieldAlert, color: 'text-amber-400', border: 'border-amber-500/60' },
    { label: 'Available volunteers', value: `${availableVolunteers.length} / ${volunteers.length}`, detail: 'Currently marked active', icon: Users, color: 'text-sky-400', border: 'border-sky-500/60' },
    { label: 'Available assets', value: `${availableResources.length} / ${resources.length}`, detail: 'Ready for assignment', icon: Truck, color: 'text-emerald-400', border: 'border-emerald-500/60' },
    { label: 'Avg response time', value: averageResponseMinutes === null ? '—' : `${averageResponseMinutes.toFixed(1)} min`, detail: `${respondingDurations.length} incident${respondingDurations.length === 1 ? '' : 's'} with timestamps`, icon: AlertOctagon, color: 'text-violet-400', border: 'border-violet-500/60' },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-6 pb-10" aria-labelledby="overview-title">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">Management workspace</p>
          <h1 id="overview-title" className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">Response overview</h1>
          <p className="mt-1 text-sm text-slate-400">A current summary of incidents, responder availability, and deployable assets.</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${isOnline ? 'text-emerald-300' : 'text-amber-300'}`}>
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {isOnline ? 'Browser online' : 'Offline · updates queued locally'}
            </span>
            <span>Last successful sync: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not yet connected'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onOpenMap} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-700">
            <MapPinned className="h-4 w-4 text-sky-300" /> Open map
          </button>
          <button onClick={onCreateIncident} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500">
            <ShieldAlert className="h-4 w-4" /> Report emergency
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, detail, icon: Icon, color, border }) => (
          <article key={label} className={`rounded-2xl border border-slate-800 border-l-4 ${border} bg-slate-900/70 p-4`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-400">{label}</h2>
              <Icon aria-hidden="true" className={`h-4 w-4 ${color}`} />
            </div>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5" aria-labelledby="operations-map-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">Live operations</p><h2 id="operations-map-title" className="mt-1 text-lg font-extrabold text-white">Emergency response map</h2><p className="mt-1 text-xs text-slate-400">Incidents, available resources, and active responders.</p></div><button onClick={onOpenMap} className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-200 transition hover:bg-slate-800">Open full map</button></div>
        <GISMapView compact incidents={incidents} resources={resources} volunteers={volunteers} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-end sm:justify-between" aria-label="Dashboard filters">
        <div>
          <label htmlFor="dashboard-range" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Date range</label>
          <select id="dashboard-range" value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="dashboard-category" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
            <select id="dashboard-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white">
              <option value="ALL">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-status" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
            <select id="dashboard-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white">
              <option value="ALL">All statuses</option>
              {[...new Set(incidents.map((incident) => incident.status).filter(Boolean))].sort().map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-area" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Area / location</label>
            <input id="dashboard-area" type="search" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} placeholder="Search area" className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5" aria-labelledby="volume-title">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="volume-title" className="font-bold text-white">Incident volume</h2>
            <span className="text-[10px] text-slate-500">Reports per day · last {rangeDays} days</span>
          </div>
          {scopedIncidents.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No reports match these filters.</p> : (
            <div className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Incident volume for the last ${rangeDays} days: ${dailyCounts.map((item) => `${item.label}, ${item.count}`).join('; ')}`}>
              {dailyCounts.map((day) => (
                <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center">
                  <span className="text-[10px] tabular-nums text-slate-300">{day.count || ''}</span>
                  <div className="flex h-28 items-end justify-center">
                    <div className="w-full max-w-8 rounded-t bg-sky-500/80" style={{ height: `${Math.max(day.count ? 8 : 2, (day.count / maxDailyCount) * 100)}%` }} />
                  </div>
                  <span className="truncate text-[9px] text-slate-500">{rangeDays === 7 ? day.label : day.label.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5" aria-labelledby="severity-title">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="severity-title" className="font-bold text-white">Severity distribution</h2>
            <span className="text-[10px] text-slate-500">{scopedIncidents.length} reports in range</span>
          </div>
          <div className="mt-5 space-y-4">
            {severityCounts.map(({ severity, count }) => (
              <div key={severity} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3">
                <span className="text-[10px] font-bold text-slate-300">{severity}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label={`${severity} incidents`} aria-valuemin={0} aria-valuemax={maxSeverityCount} aria-valuenow={count}>
                  <div className={`h-full rounded-full ${severity === 'CRITICAL' ? 'bg-red-500' : severity === 'HIGH' ? 'bg-orange-400' : severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-sky-400'}`} style={{ width: `${(count / maxSeverityCount) * 100}%` }} />
                </div>
                <span className="text-right text-xs tabular-nums text-white">{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

    </section>
  );
}
