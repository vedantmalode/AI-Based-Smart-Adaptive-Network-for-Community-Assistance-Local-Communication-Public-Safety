import React, { useMemo, useState } from 'react';
import {
  Ambulance, BadgeCheck, ClipboardCheck, HardHat, MapPinned, Radio, ShieldCheck, Stethoscope,
} from 'lucide-react';
import { VOLUNTEER_TYPES } from '../services/demoAuth';
import { calculateHaversineDistance, estimateETA } from '../services/geoMatcher';

const DASHBOARD_CONFIG = {
  MEDICAL_RESPONDER: {
    icon: Stethoscope, eyebrow: 'MEDICAL RESPONSE DESK', title: 'Doctor & First-Aid Dashboard',
    description: 'Triage clinical needs, confirm readiness, and prepare for the next medical response.', accent: 'from-rose-600 to-red-700', softAccent: 'border-rose-500/30 bg-rose-950/35 text-rose-200',
    metrics: [['Trauma kit', 'Ready'], ['Clinical response', '4.2 min'], ['Certification', 'Verified']],
    checklist: ['Trauma kit sealed', 'PPE and gloves stocked', 'Patient handover channel ready'], incidentCategory: ['Medical Emergency', 'Road Accident'],
    task: 'Assess injuries and begin first aid until formal medical transfer is available.',
  },
  RESCUE_SQUAD: {
    icon: HardHat, eyebrow: 'RESCUE SQUAD DESK', title: 'Helping Squad & Rescuer Dashboard',
    description: 'Coordinate safe approach, rescue equipment, evacuation support, and field communication.', accent: 'from-amber-500 to-orange-700', softAccent: 'border-amber-500/30 bg-amber-950/35 text-amber-200',
    metrics: [['Rescue gear', 'Ready'], ['Squad members', '04 online'], ['Safe radius', '15 km']],
    checklist: ['Helmet, gloves, and torch checked', 'Rescue rope and extraction kit ready', 'Team radio channel connected'], incidentCategory: ['Building Collapse', 'Fire', 'Flood', 'Road Accident'],
    task: 'Secure the scene, support rescue or evacuation, and report risks to command.',
  },
  MEDIC_RESOURCE_VEHICLE: {
    icon: Ambulance, eyebrow: 'MEDIC & RESOURCE FLEET DESK', title: 'Ambulance & Resource Van Dashboard',
    description: 'Track vehicle readiness, onboard stock, route availability, and delivery of emergency resources.', accent: 'from-sky-600 to-blue-800', softAccent: 'border-sky-500/30 bg-sky-950/35 text-sky-200',
    metrics: [['Vehicle status', 'Ready'], ['Fuel range', '280 km'], ['Resource load', '86%']],
    checklist: ['Fuel, tyres, and siren checked', 'Medic supplies secured', 'Navigation and radio online'], incidentCategory: ['Medical Emergency', 'Flood', 'Road Accident'],
    task: 'Transport medical support or priority resources safely to the assigned incident.',
  },
};

export default function VolunteerDashboard({ userSession, incidents, volunteers, resources, activeAssignment, onOpenMap, onAcceptAssignment }) {
  const type = userSession?.volunteerType || 'RESCUE_SQUAD';
  const config = DASHBOARD_CONFIG[type];
  const Icon = config.icon;
  const [available, setAvailable] = useState(true);
  const [checks, setChecks] = useState(config.checklist.map(() => true));
  const incident = useMemo(() => incidents.find((item) => config.incidentCategory.includes(item.category) && !['RESOLVED', 'CLOSED'].includes(item.status)) || incidents[0], [incidents, config.incidentCategory]);
  const readyCount = checks.filter(Boolean).length;
  const isPrimaryResponder = activeAssignment?.volunteerId && volunteers.some((volunteer) => volunteer.id === activeAssignment.volunteerId && volunteer.name === userSession?.name);
  const liveVolunteer = isPrimaryResponder ? volunteers.find((volunteer) => volunteer.id === activeAssignment.volunteerId) : null;
  const liveVehicle = activeAssignment?.vehicleResourceId ? resources.find((resource) => resource.id === activeAssignment.vehicleResourceId) : null;
  const routeDistance = liveVolunteer && incident ? calculateHaversineDistance(liveVolunteer.location.lat, liveVolunteer.location.lng, incident.location.lat, incident.location.lng) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 animate-fade-in">
      <section className={`relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br ${config.accent} p-6 shadow-2xl sm:p-8`}>
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4"><div className="rounded-2xl border border-white/20 bg-slate-950/20 p-3"><Icon className="h-8 w-8 text-white" /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.18em] text-white/75">{config.eyebrow}</p><h1 className="mt-1 font-heading text-2xl font-extrabold text-white sm:text-3xl">{config.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">{config.description}</p></div></div>
          <button onClick={() => setAvailable((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-extrabold transition ${available ? 'border-emerald-200/30 bg-emerald-950/35 text-emerald-100' : 'border-white/25 bg-slate-950/25 text-white'}`}><span className={`h-2.5 w-2.5 rounded-full ${available ? 'bg-emerald-300 animate-pulse' : 'bg-slate-300'}`} />{available ? 'Available for dispatch' : 'Unavailable'}</button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">{config.metrics.map(([label, value]) => <div key={label} className="glass-card p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 font-heading text-2xl font-extrabold text-white">{value}</p><span className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-emerald-300"><BadgeCheck className="h-3.5 w-3.5" /> Status confirmed</span></div>)}</div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="glass-panel rounded-2xl border border-slate-800 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-300">RECOMMENDED RESPONSE</p><h2 className="mt-1 font-heading text-xl font-bold text-white">{incident?.title || 'No matching response alert'}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{config.task}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${incident?.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>{incident?.severity || 'STANDBY'}</span></div>
          {incident && <div className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/55 p-4 sm:grid-cols-3"><span className="text-xs text-slate-400"><strong className="block text-slate-200">{incident.id}</strong> Incident ID</span><span className="text-xs text-slate-400"><strong className="block text-slate-200">{incident.location?.address || 'Map location'}</strong> Location</span><span className="text-xs text-slate-400"><strong className="block text-slate-200">{incident.peopleAffected || 0} people</strong> Affected</span></div>}
          <div className="mt-5 flex flex-wrap gap-3"><button onClick={onOpenMap} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"><MapPinned className="h-4 w-4" /> {isPrimaryResponder ? 'Open live route map' : 'Open incident map'}</button>{!isPrimaryResponder && <button onClick={() => onAcceptAssignment(incident, type)} disabled={!available || !incident} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/60 px-4 py-2.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-50"><Radio className="h-4 w-4 text-emerald-300" /> Accept & start live route</button>}</div>
          {isPrimaryResponder && <div className="mt-5 grid gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 sm:grid-cols-3"><div><p className="text-[10px] font-mono font-bold tracking-wider text-emerald-300">YOUR LIVE LOCATION</p><p className="mt-1 text-xs text-slate-200">{liveVolunteer.location.lat.toFixed(4)}, {liveVolunteer.location.lng.toFixed(4)}</p></div><div><p className="text-[10px] font-mono font-bold tracking-wider text-emerald-300">SHORTEST DISTANCE</p><p className="mt-1 text-xs text-slate-200">{routeDistance} km · est. {estimateETA(routeDistance)} min</p></div><div><p className="text-[10px] font-mono font-bold tracking-wider text-emerald-300">MEDIC & RESOURCE VEHICLE</p><p className="mt-1 text-xs text-slate-200">{liveVehicle ? `${liveVehicle.location.lat.toFixed(4)}, ${liveVehicle.location.lng.toFixed(4)}` : 'Vehicle availability pending'}</p></div></div>}
        </section>
        <aside className="glass-panel rounded-2xl border border-slate-800 p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-slate-400">READINESS CHECK</p><h2 className="mt-1 font-heading text-lg font-bold text-white">{readyCount}/{checks.length} checks complete</h2></div><ClipboardCheck className="h-7 w-7 text-emerald-300" /></div><div className="mt-5 space-y-2">{config.checklist.map((item, index) => <label key={item} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs transition ${checks[index] ? config.softAccent : 'border-slate-800 bg-slate-950/50 text-slate-400'}`}><input checked={checks[index]} onChange={() => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} type="checkbox" className="h-4 w-4 accent-emerald-500" /><span>{item}</span></label>)}</div><div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-300" /> {VOLUNTEER_TYPES[type].description}</div></aside>
      </div>
    </div>
  );
}
