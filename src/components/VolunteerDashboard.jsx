import React, { useEffect, useMemo, useState } from 'react';
import {
  Ambulance, BadgeCheck, ClipboardCheck, HardHat, MapPinned, ShieldCheck, Stethoscope,
} from 'lucide-react';
import { VOLUNTEER_TYPES } from '../services/roleConfig';
import { calculateHaversineDistance, hasValidCoordinates } from '../services/geoMatcher';
import { fetchShortestRoadRoute } from '../services/roadRouting';

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
  OTHER: {
    icon: ShieldCheck, eyebrow: 'COMMUNITY VOLUNTEER DESK', title: 'Community Volunteer Dashboard',
    description: 'Support responders with local information, communication, and other community assistance.', accent: 'from-cyan-600 to-blue-800', softAccent: 'border-cyan-500/30 bg-cyan-950/35 text-cyan-200',
    metrics: [['Community support', 'Ready'], ['Field updates', 'Available'], ['Safe radius', '15 km']],
    checklist: ['Phone charged and reachable', 'Know the nearest safe location', 'Ready to share field updates'], incidentCategory: ['Fire', 'Road Accident', 'Medical Emergency', 'Flood', 'Building Collapse', 'Electrical Emergency', 'Gas Leak'],
    task: 'Share verified local information and help coordinate safe community support.',
  },
};

export default function VolunteerDashboard({ userSession, incidents, volunteers, resources, activeAssignment, onOpenMap, onAvailabilityChange }) {
  const type = userSession?.volunteerType || 'RESCUE_SQUAD';
  const config = DASHBOARD_CONFIG[type];
  const Icon = config.icon;
  const [available, setAvailable] = useState(true);
  const [checks, setChecks] = useState(config.checklist.map(() => true));
  const [roadRoute, setRoadRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle');
  const ownVolunteer = volunteers.find((volunteer) => volunteer.id === userSession?.volunteerId || volunteer.name === userSession?.name);
  useEffect(() => {
    setAvailable(ownVolunteer?.status === 'ACTIVE' && String(ownVolunteer?.availability || '').toLowerCase() !== 'unavailable');
  }, [ownVolunteer?.id, ownVolunteer?.status, ownVolunteer?.availability]);
  const isPrimaryResponder = Boolean(activeAssignment?.volunteerId && ownVolunteer?.id === activeAssignment.volunteerId);
  const incident = useMemo(() => {
    const assignedIncident = isPrimaryResponder && activeAssignment?.incidentId
      ? incidents.find((item) => item.id === activeAssignment.incidentId)
      : null;
    return assignedIncident || incidents.find((item) => config.incidentCategory.includes(item.category) && !['RESOLVED', 'CLOSED'].includes(item.status)) || incidents[0];
  }, [incidents, config.incidentCategory, isPrimaryResponder, activeAssignment?.incidentId]);
  const readyCount = checks.filter(Boolean).length;
  const liveVolunteer = isPrimaryResponder ? volunteers.find((volunteer) => volunteer.id === activeAssignment.volunteerId) : null;
  const liveVehicle = activeAssignment?.vehicleResourceId ? resources.find((resource) => resource.id === activeAssignment.vehicleResourceId) : null;
  const routeDistance = liveVolunteer && incident && hasValidCoordinates(liveVolunteer.location) && hasValidCoordinates(incident.location)
    ? calculateHaversineDistance(liveVolunteer.location.lat, liveVolunteer.location.lng, incident.location.lat, incident.location.lng)
    : null;

  useEffect(() => {
    if (!isPrimaryResponder || !hasValidCoordinates(liveVolunteer?.location) || !hasValidCoordinates(incident?.location)) {
      setRoadRoute(null);
      setRouteStatus(isPrimaryResponder ? 'unavailable' : 'idle');
      return undefined;
    }
    const controller = new AbortController();
    setRoadRoute(null);
    setRouteStatus('loading');
    fetchShortestRoadRoute(liveVolunteer.location, incident.location, controller.signal)
      .then((route) => { setRoadRoute(route); setRouteStatus('ready'); })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setRoadRoute(null);
        setRouteStatus('unavailable');
      });
    return () => controller.abort();
  }, [isPrimaryResponder, liveVolunteer?.location?.lat, liveVolunteer?.location?.lng, incident?.location?.lat, incident?.location?.lng]);

  const openRouteMap = () => onOpenMap?.(isPrimaryResponder ? {
    incident,
    origin: liveVolunteer?.location,
    route: roadRoute,
    routeStatus,
  } : { incident });

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 animate-fade-in">
      <section className={`relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br ${config.accent} p-6 shadow-2xl sm:p-8`}>
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4"><div className="rounded-2xl border border-white/20 bg-slate-950/20 p-3"><Icon className="h-8 w-8 text-white" /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.18em] text-white/75">{config.eyebrow}</p><h1 className="mt-1 font-heading text-2xl font-extrabold text-white sm:text-3xl">{config.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">{config.description}</p></div></div>
          <button type="button" disabled={isPrimaryResponder} onClick={() => onAvailabilityChange?.(!available)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${available ? 'border-emerald-200/30 bg-emerald-950/35 text-emerald-100' : 'border-white/25 bg-slate-950/25 text-white'}`}><span className={`h-2.5 w-2.5 rounded-full ${available ? 'bg-emerald-300' : 'bg-slate-300'}`} />{isPrimaryResponder ? 'Assigned to active incident' : available ? 'Available for dispatch' : 'Unavailable'}</button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">{config.metrics.map(([label, value]) => <div key={label} className="glass-card p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 font-heading text-2xl font-extrabold text-white">{value}</p><span className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-emerald-300"><BadgeCheck className="h-3.5 w-3.5" /> Status confirmed</span></div>)}</div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="glass-panel rounded-2xl border border-slate-800 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-300">RECOMMENDED RESPONSE</p><h2 className="mt-1 font-heading text-xl font-bold text-white">{incident?.title || 'No matching response alert'}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{config.task}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${incident?.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>{incident?.severity || 'STANDBY'}</span></div>
          {incident && <div className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/55 p-4 sm:grid-cols-3"><span className="text-xs text-slate-400"><strong className="block text-slate-200">{incident.id}</strong> Incident ID</span><span className="text-xs text-slate-400"><strong className="block text-slate-200">{incident.location?.address || 'Map location'}</strong> Location</span><span className="text-xs text-slate-400"><strong className="block text-slate-200">{incident.peopleAffected || 0} people</strong> Affected</span></div>}
          <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={openRouteMap} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"><MapPinned className="h-4 w-4" /> {isPrimaryResponder ? 'Open live route & directions' : 'Open incident map'}</button>{!isPrimaryResponder && <p className="text-[11px] leading-5 text-slate-400">Availability is shared with dispatch. The Management room dispatcher makes official assignments.</p>}</div>
          {isPrimaryResponder && <>
            <div className="mt-5 grid gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 sm:grid-cols-3"><div><p className="text-[10px] font-mono font-bold tracking-wider text-emerald-300">YOUR LIVE LOCATION</p><p className="mt-1 text-xs text-slate-200">{hasValidCoordinates(liveVolunteer?.location) ? `${Number(liveVolunteer.location.lat).toFixed(4)}, ${Number(liveVolunteer.location.lng).toFixed(4)}` : 'Location unavailable'}</p></div><div><p className="text-[10px] font-mono font-bold tracking-wider text-emerald-300">SHORTEST AVAILABLE ROAD ROUTE</p><p className="mt-1 text-xs text-slate-200">{routeStatus === 'loading' ? 'Finding road route…' : roadRoute ? `${roadRoute.distanceKm.toFixed(2)} km · est. ${roadRoute.durationMinutes} min` : routeDistance === null ? 'Route unavailable · location unavailable' : `Route unavailable · ${routeDistance.toFixed(2)} km direct distance`}</p><p className="mt-1 text-[10px] text-slate-500">{roadRoute ? 'ETA has no live traffic data.' : routeStatus === 'unavailable' ? 'Check connection and GPS, then reopen the route map.' : ''}</p></div><div><p className="text-[10px] font-mono font-bold tracking-wider text-emerald-300">MEDIC & RESOURCE VEHICLE</p><p className="mt-1 text-xs text-slate-200">{hasValidCoordinates(liveVehicle?.location) ? `${Number(liveVehicle.location.lat).toFixed(4)}, ${Number(liveVehicle.location.lng).toFixed(4)}` : 'Vehicle location unavailable'}</p></div></div>
            {roadRoute?.steps?.length > 0 && <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/55 p-4"><summary className="cursor-pointer text-sm font-bold text-white">Turn-by-turn directions <span className="ml-1 text-xs font-normal text-slate-400">({roadRoute.steps.length} steps)</span></summary><ol className="mt-3 max-h-64 space-y-2 overflow-y-auto">{roadRoute.steps.map((step, index) => <li key={`${step.instruction}-${index}`} className="flex gap-3 rounded-lg bg-slate-900/80 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-950 text-[11px] font-bold text-sky-200">{index + 1}</span><span className="min-w-0 text-xs leading-5 text-slate-200">{step.instruction}<span className="ml-2 text-[10px] text-slate-500">{step.distanceLabel}</span></span></li>)}</ol><p className="mt-3 text-[10px] leading-4 text-slate-500">Road path from OpenStreetMap routing data; conditions and closures may change. Follow traffic rules and emergency command guidance.</p></details>}
          </>}
        </section>
        <aside className="glass-panel rounded-2xl border border-slate-800 p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-slate-400">READINESS CHECK</p><h2 className="mt-1 font-heading text-lg font-bold text-white">{readyCount}/{checks.length} checks complete</h2></div><ClipboardCheck className="h-7 w-7 text-emerald-300" /></div><div className="mt-5 space-y-2">{config.checklist.map((item, index) => <label key={item} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs transition ${checks[index] ? config.softAccent : 'border-slate-800 bg-slate-950/50 text-slate-400'}`}><input checked={checks[index]} onChange={() => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} type="checkbox" className="h-4 w-4 accent-emerald-500" /><span>{item}</span></label>)}</div><div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-300" /> {VOLUNTEER_TYPES[type].description}</div></aside>
      </div>
    </div>
  );
}
