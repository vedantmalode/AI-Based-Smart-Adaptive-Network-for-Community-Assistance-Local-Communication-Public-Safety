import React from 'react';
import { CheckCircle2, ClipboardCheck, Download, MapPin } from 'lucide-react';
import { downloadIncidentPdf } from '../services/incidentPdf';
import { isResponsePlanComplete } from '../services/responsePlan';

export default function CompletedIncidents({ incidents = [], volunteers = [], resources = [], onOpenIncident }) {
  const completedIncidents = incidents.filter(isResponsePlanComplete);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12 animate-fade-in">
      <header className="glass-panel flex flex-col justify-between gap-3 rounded-2xl border border-emerald-800/50 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Incident archive</p>
          <h1 className="mt-1 text-2xl font-extrabold text-white">Completed Incidents</h1>
            <p className="mt-1 text-sm text-slate-400">Resolved incidents and incidents with a fully completed response checklist are archived here.</p>
        </div>
        <span className="rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-4 py-2 text-sm font-bold text-emerald-200">{completedIncidents.length} complete</span>
      </header>

      {completedIncidents.length ? <div className="space-y-3">
        {completedIncidents.map((incident) => {
          const assignedVolunteerNames = (incident.assignedVolunteers || []).map((id) => volunteers.find((volunteer) => volunteer.id === id)?.name || id);
          const assignedResourceNames = (incident.assignedResources || []).map((id) => resources.find((resource) => resource.id === id)?.name || id);
          return <article key={incident.id} className="glass-panel rounded-2xl border border-slate-800 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <button type="button" onClick={() => onOpenIncident(incident)} className="min-w-0 text-left">
                <span className="font-mono text-[11px] text-slate-400">{incident.id}</span>
                <h2 className="mt-0.5 text-lg font-bold text-white hover:text-emerald-200">{incident.category || 'Incident'} <CheckCircle2 className="ml-1 inline h-4 w-4 text-emerald-400" /></h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-300">{incident.description || 'No description recorded.'}</p>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{incident.location?.address || 'Location unavailable'}</p>
              </button>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={() => onOpenIncident(incident)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">View details</button>
                <button type="button" onClick={() => downloadIncidentPdf(incident, volunteers, resources, incident.responseTasks)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><Download className="h-4 w-4" />Download PDF</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-slate-800 pt-3 text-xs sm:grid-cols-3">
              <p className="text-slate-400"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Severity</span><strong className="mt-1 inline-block text-slate-200">{incident.severity || 'Unrated'} · {incident.priorityScore ?? '—'}/100</strong></p>
              <p className="text-slate-400"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Volunteers</span><strong className="mt-1 inline-block text-slate-200">{assignedVolunteerNames.join(', ') || 'None assigned'}</strong></p>
              <p className="text-slate-400"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Ambulance / resources</span><strong className="mt-1 inline-block text-slate-200">{assignedResourceNames.join(', ') || 'None assigned'}</strong></p>
            </div>
            {Array.isArray(incident.responseTasks) && <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300"><ClipboardCheck className="h-3.5 w-3.5" />{incident.responseTasks.filter((task) => task.completed).length} of {incident.responseTasks.length} tasks completed</p>}
          </article>;
        })}
      </div> : <div className="glass-panel flex min-h-56 flex-col items-center justify-center rounded-2xl border border-slate-800 p-8 text-center">
        <ClipboardCheck className="h-8 w-8 text-slate-500" />
        <h2 className="mt-3 text-base font-bold text-white">No completed incidents yet</h2>
        <p className="mt-1 max-w-md text-sm text-slate-400">Resolve an incident or complete all of its response checklist tasks to archive it here.</p>
      </div>}
    </div>
  );
}
