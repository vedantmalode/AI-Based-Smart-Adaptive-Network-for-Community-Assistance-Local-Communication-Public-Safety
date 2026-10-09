import React, { useEffect, useState } from 'react';
import { ArrowLeft, BrainCircuit, Check, CheckCircle2, Circle, Clock3, MapPin, ShieldAlert, Truck, Users } from 'lucide-react';
import GISMapView from './GISMapView';
import { createResponsePlan } from '../services/responsePlan';

export default function IncidentDetailPage({ incident, resources = [], volunteers = [], onBack, onToggleTask, onDispatch, onOverrideTriage, canOverrideTriage = false }) {
  const [overrideCategory, setOverrideCategory] = useState(incident?.category || 'Other');
  const [overridePriority, setOverridePriority] = useState(incident?.priorityBand || 'P2');
  const [overrideReason, setOverrideReason] = useState('');
  useEffect(() => {
    setOverrideCategory(incident?.category || 'Other');
    setOverridePriority(incident?.priorityBand || 'P2');
    setOverrideReason('');
  }, [incident?.id]);
  if (!incident) return null;
  const tasks = Array.isArray(incident.responseTasks) ? incident.responseTasks : createResponsePlan(incident);
  const completedCount = tasks.filter((task) => task.completed).length;
  const hasCoordinates = Number.isFinite(incident.location?.lat) && Number.isFinite(incident.location?.lng);
  const assignedVolunteers = (incident.assignedVolunteers || []).map((id) => volunteers.find((item) => item.id === id) || { id, name: id, status: 'Details unavailable' });
  const assignedResources = (incident.assignedResources || []).map((id) => resources.find((item) => item.id === id) || { id, name: id, type: 'Resource', status: 'Details unavailable' });
  const assignedAmbulances = assignedResources.filter((resource) => resource.type?.toLowerCase().includes('ambulance'));
  const assignedOtherResources = assignedResources.filter((resource) => !resource.type?.toLowerCase().includes('ambulance'));

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12 animate-fade-in">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to incidents
      </button>

      <header className="glass-panel rounded-2xl border border-slate-800 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="font-mono text-xs text-slate-400">{incident.id}</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">{incident.category || 'Incident'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{incident.description || 'No incident description was provided.'}</p>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-400"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />{incident.location?.address || 'Location address unavailable'}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-xs font-bold text-red-200">{incident.severity || 'UNRATED'} · {incident.priorityScore ?? '—'}/100</span>
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200">{String(incident.status || 'REPORTED').replaceAll('_', ' ')}</span>
            {onDispatch && <button type="button" onClick={() => onDispatch(incident)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Dispatch responders</button>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <span>Affected: <strong className="text-white">{incident.peopleAffectedKnown === false ? 'Unknown' : incident.peopleAffected ?? 'Unknown'}</strong></span>
          <span>Injuries reported: <strong className={incident.injuries ? 'text-red-300' : 'text-slate-200'}>{incident.injuries ? 'Yes' : 'No'}</strong></span>
          <span>Reported: <strong className="text-slate-200">{incident.reportedAt ? new Date(incident.reportedAt).toLocaleString() : 'Time unavailable'}</strong></span>
        </div>
      </header>

      <section className="glass-panel rounded-2xl border border-violet-500/20 p-4 sm:p-5 space-y-4" aria-labelledby="triage-explanation-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="triage-explanation-title" className="flex items-center gap-2 text-lg font-bold text-white"><BrainCircuit className="h-5 w-5 text-violet-300" />AI triage explanation</h2><p className="mt-1 text-xs text-slate-400">Rule-based decision support. A human responder makes the final triage decision.</p></div>
          <span className="rounded-full border border-violet-500/30 bg-violet-950/40 px-3 py-1.5 text-xs font-bold text-violet-200">Confidence {Math.round((incident.aiRecommendation?.confidence ?? incident.confidence ?? 0) * 100)}%</span>
        </div>
        <p className="text-xs leading-5 text-slate-300">{incident.aiRecommendation?.priorityBand || incident.priorityBand || 'Priority pending'} · {incident.aiRecommendation?.severity || incident.severity || 'Unrated'} suggested. {incident.aiRecommendation?.category || incident.category}</p>
        <p className="text-[10px] leading-4 text-slate-500">{incident.confidenceNote || 'Confidence is a heuristic based on report detail and matched signals; it is not a calibrated probability.'}</p>
        {(incident.aiRecommendation?.priorityReasons || incident.priorityReasons || []).length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">{(incident.aiRecommendation?.priorityReasons || incident.priorityReasons).map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul>}
        {(incident.missingInformation || []).length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3"><p className="text-[11px] font-bold text-amber-200">Information to confirm</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-100/80">{incident.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        {(incident.reviewFlags || []).length > 0 && <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 p-3"><p className="text-[11px] font-bold text-orange-200">Human review flags · report retained</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-orange-100/80">{incident.reviewFlags.map((item) => <li key={item}>{item}</li>)}</ul>{(incident.potentialDuplicates || []).map((item) => <p key={item.id} className="mt-1 text-[11px] text-orange-100/70">Compare with {item.id} ({item.category}).</p>)}</div>}
        {incident.triageOverride && <p className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-100">Human override: {incident.triageOverride.category}, {incident.triageOverride.priorityBand} · {incident.triageOverride.reason} · by {incident.triageOverride.by} at {new Date(incident.triageOverride.at).toLocaleString()}</p>}
        {canOverrideTriage && <div className="border-t border-slate-800 pt-4 space-y-3">
          <h3 className="text-sm font-bold text-white">Override category or priority</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-300">Category<select value={overrideCategory} onChange={(event) => setOverrideCategory(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white">{['Fire', 'Medical Emergency', 'Road Accident', 'Flood', 'Earthquake', 'Building Collapse', 'Electrical Emergency', 'Gas Leak', 'Crime/Security', 'Cyclone/Storm', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-300">Priority<select value={overridePriority} onChange={(event) => setOverridePriority(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"><option value="P0">P0 · Critical</option><option value="P1">P1 · High</option><option value="P2">P2 · Medium</option><option value="P3">P3 · Low</option></select></label>
          </div>
          <label className="block text-xs font-semibold text-slate-300">Reason for change<input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} maxLength={300} placeholder="Explain what the AI missed or what new information changed the triage" className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500" /></label>
          <button type="button" disabled={!overrideReason.trim() || !onOverrideTriage} onClick={() => { onOverrideTriage({ category: overrideCategory, priorityBand: overridePriority, reason: overrideReason.trim() }); setOverrideReason(''); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Save human override</button>
        </div>}
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Incident assignments">
        <div className="glass-panel rounded-2xl border border-slate-800 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-white"><Users className="h-4 w-4 text-blue-300" />Allotted volunteers</h2>
          {assignedVolunteers.length ? <ul className="mt-3 space-y-2">{assignedVolunteers.map((volunteer) => <li key={volunteer.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5"><div><p className="text-sm font-semibold text-slate-100">{volunteer.name}</p><p className="text-[11px] text-slate-500">{volunteer.id}{volunteer.volunteerType ? ` · ${volunteer.volunteerType.replaceAll('_', ' ')}` : ''}</p></div><span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300">{volunteer.status || 'Assigned'}</span></li>)}</ul>
            : <p className="mt-3 rounded-xl border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">No volunteers have been allotted to this incident yet.</p>}
        </div>
        <div className="glass-panel rounded-2xl border border-slate-800 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-white"><Truck className="h-4 w-4 text-emerald-300" />Assigned ambulance</h2>
          {assignedAmbulances.length ? <ul className="mt-3 space-y-2">{assignedAmbulances.map((resource) => <li key={resource.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5"><div><p className="text-sm font-semibold text-slate-100">{resource.name}</p><p className="text-[11px] text-slate-500">{resource.id}{resource.ownerOrg ? ` · ${resource.ownerOrg}` : ''}</p></div><span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300">{resource.status || 'Assigned'}</span></li>)}</ul>
            : <p className="mt-3 rounded-xl border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">No ambulance has been assigned yet. Use Dispatch responders to assign an available ambulance.</p>}
          {assignedOtherResources.length > 0 && <div className="mt-4 border-t border-slate-800 pt-3"><h3 className="text-xs font-semibold text-slate-300">Other assigned resources</h3><ul className="mt-2 space-y-2">{assignedOtherResources.map((resource) => <li key={resource.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"><div><p className="text-xs font-semibold text-slate-200">{resource.name}</p><p className="text-[10px] text-slate-500">{resource.id} · {resource.type}</p></div><span className="text-[10px] text-slate-400">{resource.status || 'Assigned'}</span></li>)}</ul></div>}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><h2 className="text-lg font-bold text-white">Incident location</h2><p className="text-xs text-slate-400">{hasCoordinates ? `${incident.location.lat.toFixed(5)}, ${incident.location.lng.toFixed(5)}` : 'Map coordinates are not available for this report.'}</p></div>
          </div>
          {hasCoordinates
            ? <GISMapView compact incidents={[incident]} resources={resources} volunteers={volunteers} focusIncident={incident} />
            : <div className="flex h-[320px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400">No coordinates were attached to this incident, so its map location cannot be shown.</div>}
        </div>

        <section className="glass-panel rounded-2xl border border-slate-800 p-4 sm:p-5" aria-labelledby="response-plan-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="response-plan-title" className="flex items-center gap-2 text-lg font-bold text-white"><BrainCircuit className="h-5 w-5 text-violet-300" /> AI response checklist</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Suggested actions based on the incident category and reported risks. Confirm each action when it is complete.</p>
            </div>
            <span className="shrink-0 rounded-full border border-violet-500/30 bg-violet-950/40 px-2.5 py-1 text-[11px] font-bold text-violet-200">{completedCount}/{tasks.length} complete</span>
          </div>
          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className={`rounded-xl border p-3 transition ${task.completed ? 'border-emerald-700/60 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/50'}`}>
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => onToggleTask(task.id)} aria-label={`${task.completed ? 'Mark incomplete' : 'Confirm complete'}: ${task.title}`} aria-pressed={Boolean(task.completed)} className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold ${task.completed ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500 hover:text-white'}`}>
                    {task.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    {task.completed ? 'Completed' : 'Mark complete'}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${task.completed ? 'text-emerald-200' : 'text-white'}`}>{task.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{task.guidance}</p>
                    {task.completed && <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><Check className="h-3 w-3" />Completed{task.completedAt ? ` · ${new Date(task.completedAt).toLocaleString()}` : ''}{task.completedBy ? ` by ${task.completedBy}` : ''}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-100/80"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />Decision support only. Follow local emergency procedures and responder instructions.</p>
        </section>
      </section>

      <div className="flex items-center gap-2 text-[11px] text-slate-500"><Clock3 className="h-3.5 w-3.5" />Checklist updates are saved with the incident and synchronized when a connection is available.</div>
    </div>
  );
}
