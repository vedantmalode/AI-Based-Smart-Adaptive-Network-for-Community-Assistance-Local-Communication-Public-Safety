import React, { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Activity, AlertTriangle, Navigation, Radio, Search, Truck, UserRound } from 'lucide-react';
import { NAGPUR_CENTER } from '../services/mockData';
import { hasValidCoordinates } from '../services/geoMatcher';
import { fetchShortestRoadRoute } from '../services/roadRouting';

const LIVE_RESOURCE_ICON = L.divIcon({
  html: `<div style="position:relative"><div style="background:#059669;color:white;border-radius:8px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2.5px solid #10b981;box-shadow:0 0 12px rgba(16,185,129,.9)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="8" height="8" x="8" y="8" rx="1"/></svg></div><span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:#10b981;border-radius:50%;border:1.5px solid white"></span></div>`,
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const VOLUNTEER_ICON = L.divIcon({
  html: `<div style="background:#2563eb;color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 0 12px rgba(37,99,235,.85)"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const INCIDENT_COLORS = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#16a34a' };
const INCIDENT_ICONS = Object.fromEntries(Object.entries(INCIDENT_COLORS).map(([priority, color]) => [priority, L.divIcon({
  html: `<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};color:white;border:2px solid white;box-shadow:0 2px 8px #0f172a66;font:bold 17px system-ui">!</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})]));

function locationFreshness(lastSeenAt) {
  if (!lastSeenAt) return 'Location update time unavailable';
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'Location update time unavailable';
  if (ageMs < 60000) return 'Location updated less than a minute ago';
  const minutes = Math.floor(ageMs / 60000);
  return `Location updated ${minutes} min ago${minutes >= 5 ? ' · may be stale' : ''}`;
}

function FitRouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length > 1) map.fitBounds(positions, { padding: [48, 48], maxZoom: 16 });
  }, [map, positions]);
  return null;
}

export default function GISMapView({ resources, volunteers = [], incidents = [], activeVolunteerName, compact = false, focusIncident = null, routeGuide = null }) {
  const [showResources, setShowResources] = useState(true);
  const [showVolunteers, setShowVolunteers] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [routedPath, setRoutedPath] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState('');
  useEffect(() => {
    if (!routeGuide || routeGuide.route || !hasValidCoordinates(routeGuide.origin) || !hasValidCoordinates(routeGuide.incident?.location)) {
      setRoutedPath(null);
      setRoutingLoading(false);
      setRoutingError('');
      return undefined;
    }
    const controller = new AbortController();
    setRoutedPath(null);
    setRoutingLoading(true);
    setRoutingError('');
    fetchShortestRoadRoute(routeGuide.origin, routeGuide.incident.location, controller.signal)
      .then(setRoutedPath)
      .catch((error) => { if (error.name !== 'AbortError') setRoutingError(error.message || 'Road route unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setRoutingLoading(false); });
    return () => controller.abort();
  }, [routeGuide?.incident?.id, routeGuide?.origin?.lat, routeGuide?.origin?.lng, routeGuide?.route]);
  const activeVolunteers = volunteers.filter((volunteer) => volunteer.status === 'ACTIVE');
  const query = search.trim().toLowerCase();
  const mappableResources = resources.filter((resource) => Number.isFinite(resource.location?.lat) && Number.isFinite(resource.location?.lng)
    && (!query || `${resource.name} ${resource.type} ${resource.ownerOrg || ''}`.toLowerCase().includes(query)));
  const mappableVolunteers = activeVolunteers.filter((volunteer) => Number.isFinite(volunteer.location?.lat) && Number.isFinite(volunteer.location?.lng)
    && (!query || `${volunteer.name} ${(volunteer.skills || []).join(' ')}`.toLowerCase().includes(query)));
  const mappableIncidents = incidents.filter((incident) => Number.isFinite(incident.location?.lat) && Number.isFinite(incident.location?.lng)
    && (priorityFilter === 'ALL' || String(incident.authorityPriority || incident.severity || incident.aiPriority || 'LOW').toUpperCase() === priorityFilter)
    && (!query || `${incident.id} ${incident.category} ${incident.title || ''} ${incident.location?.address || ''}`.toLowerCase().includes(query)));
  const mapCenter = Number.isFinite(focusIncident?.location?.lat) && Number.isFinite(focusIncident?.location?.lng)
    ? [focusIncident.location.lat, focusIncident.location.lng]
    : [NAGPUR_CENTER.lat, NAGPUR_CENTER.lng];
  const roadRoute = routeGuide?.route || routedPath;
  const routePositions = roadRoute?.coordinates || [];
  const routeOrigin = routeGuide?.origin;
  const routeDestination = routeGuide?.incident?.location;
  const navigationUrl = routeOrigin && routeDestination
    ? `https://www.google.com/maps/dir/?api=1&origin=${routeOrigin.lat},${routeOrigin.lng}&destination=${routeDestination.lat},${routeDestination.lng}&travelmode=driving`
    : null;

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-fade-in">
      {!compact && <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-heading font-extrabold text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              Emergency & Resource Map — Nagpur, Maharashtra
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
              <Activity className="w-3 h-3" /> Latest available locations
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">See reported incidents, emergency resources, and active volunteers across the city.</p>
        </div>
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Filter map results by name, incident, skill, or area</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents and responders" className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white placeholder:text-slate-500" />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white">
            <option value="ALL">All</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
          </select>
        </label>
        <button type="button" onClick={() => setShowIncidents((visible) => !visible)} aria-pressed={showIncidents} className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition ${showIncidents ? 'border-red-600/60 bg-red-950/80 text-red-200' : 'border-slate-800 bg-slate-900 text-slate-500'}`}>
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Incidents ({mappableIncidents.length})
        </button>
        <button
          onClick={() => setShowResources((visible) => !visible)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${showResources ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow' : 'bg-slate-900 text-slate-500 border-slate-800'}`}
        >
          <Truck className="w-3.5 h-3.5 text-emerald-400" />
          Live Resources ({resources.length})
        </button>
        <button
          onClick={() => setShowVolunteers((visible) => !visible)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${showVolunteers ? 'bg-blue-950/80 text-blue-300 border-blue-600/60 shadow' : 'bg-slate-900 text-slate-500 border-slate-800'}`}
        >
          <UserRound className="w-3.5 h-3.5" />
          Active Volunteers ({activeVolunteers.length})
        </button>
      </div>}

      {routeGuide && <section className="glass-panel grid gap-4 rounded-2xl border border-sky-800/50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]" aria-label="Live route directions">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-sky-300">VOLUNTEER ROUTE GUIDE</p><h2 className="mt-1 text-lg font-extrabold text-white">{routeGuide.incident?.title || routeGuide.incident?.category || 'Assigned incident'}</h2><p className="mt-1 text-xs text-slate-400">{routeGuide.incident?.location?.address || 'Incident location'}</p></div>{navigationUrl && <a href={navigationUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white hover:bg-sky-500"><Navigation className="h-4 w-4" />Open turn-by-turn navigation</a>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">Shortest available road option</p><p className="mt-1 text-sm font-bold text-white">{roadRoute ? `${roadRoute.distanceKm.toFixed(2)} km` : routingLoading || routeGuide.routeStatus === 'loading' ? 'Finding route…' : 'Unavailable'}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">Estimated drive</p><p className="mt-1 text-sm font-bold text-white">{roadRoute ? `${roadRoute.durationMinutes} min` : '—'}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">Route status</p><p className="mt-1 text-sm font-bold text-white">{roadRoute ? 'Path ready' : routingLoading || routeGuide.routeStatus === 'loading' ? 'Loading' : 'Check GPS or connection'}</p></div></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">The route is the shortest-distance option returned by the road router. Travel time is an estimate without live traffic. Verify road closures and follow emergency command guidance.</p>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Directions</h3>
          {roadRoute?.steps?.length ? <ol className="mt-2 space-y-2">{roadRoute.steps.map((step, index) => <li key={`${step.instruction}-${index}`} className="flex gap-2 border-b border-slate-800/70 pb-2 last:border-0"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-950 text-[10px] font-bold text-sky-200">{index + 1}</span><span className="text-xs leading-5 text-slate-200">{step.instruction}<span className="ml-1 text-[10px] text-slate-500">{step.distanceLabel}</span></span></li>)}</ol> : <p className="mt-2 text-xs leading-5 text-slate-400">{routingLoading || routeGuide.routeStatus === 'loading' ? 'Getting road directions…' : routingError || 'Road directions are unavailable. Check that GPS and internet are available, then reopen the live route.'}</p>}
        </div>
      </section>}

      <div className={`relative ${compact ? 'h-[400px]' : 'h-[620px]'} w-full rounded-2xl overflow-hidden border border-slate-800 glass-panel shadow-2xl`}>
        <MapContainer key={routeGuide?.incident?.id || focusIncident?.id || 'city-map'} center={routeOrigin ? [routeOrigin.lat, routeOrigin.lng] : mapCenter} zoom={focusIncident ? 15 : 13} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
          <FitRouteBounds positions={routePositions} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {routePositions.length > 1 && <Polyline positions={routePositions} pathOptions={{ color: '#06b6d4', weight: 7, opacity: 0.9 }} />}
          {routeOrigin && <CircleMarker center={[routeOrigin.lat, routeOrigin.lng]} radius={9} pathOptions={{ color: '#082f49', fillColor: '#22d3ee', fillOpacity: 1, weight: 3 }}><Popup>Volunteer start location</Popup></CircleMarker>}
          {routeDestination && Number.isFinite(routeDestination.lat) && Number.isFinite(routeDestination.lng) && <CircleMarker center={[routeDestination.lat, routeDestination.lng]} radius={9} pathOptions={{ color: '#450a0a', fillColor: '#ef4444', fillOpacity: 1, weight: 3 }}><Popup>Incident destination</Popup></CircleMarker>}
          {showIncidents && mappableIncidents.map((incident) => {
            const priority = String(incident.authorityPriority || incident.severity || incident.aiPriority || 'LOW').toUpperCase();
            const icon = INCIDENT_ICONS[priority] || INCIDENT_ICONS.LOW;
            return <Marker key={incident.id} position={[incident.location.lat, incident.location.lng]} icon={icon}>
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-900">{incident.id} · {incident.category}</div>
                  <div><strong style={{ color: INCIDENT_COLORS[priority] || INCIDENT_COLORS.LOW }}>{priority}</strong> · {incident.status || 'REPORTED'}</div>
                  <div>{incident.title || incident.location.address || 'Emergency report'}</div>
                  <div className="text-[11px] text-slate-600">{incident.location.address || `${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}`}</div>
                </div>
              </Popup>
            </Marker>;
          })}
          {showResources && mappableResources.map((resource) => (
            <Marker key={resource.id} position={[resource.location.lat, resource.location.lng]} icon={LIVE_RESOURCE_ICON}>
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5"><Truck className="w-4 h-4" />{resource.name}</div>
                  <div className="text-[11px] text-slate-300">Type: {resource.type} | Status: <strong className="text-emerald-400">{resource.status}</strong></div>
                  <div className="text-[10px] text-amber-300">{locationFreshness(resource.locationUpdatedAt)}</div>
                  <div className="text-[11px] text-slate-400">Owner: {resource.ownerOrg}</div>
                  <div className="text-[11px] text-slate-400">Details: {resource.details}</div>
                </div>
              </Popup>
            </Marker>
          ))}
          {showVolunteers && mappableVolunteers.map((volunteer) => (
            <Marker key={volunteer.id} position={[volunteer.location.lat, volunteer.location.lng]} icon={VOLUNTEER_ICON}>
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5"><UserRound className="w-4 h-4" />{volunteer.name}</div>
                  <div className="text-[11px] text-slate-300">Status: <strong className={volunteer.status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-300'}>{volunteer.status}</strong></div>
                  <div className="text-[11px] text-slate-400">Volunteer ID: {volunteer.id}</div>
                  <div className={`text-[10px] ${volunteer.lastSeenAt && Date.now() - new Date(volunteer.lastSeenAt).getTime() < 300000 ? 'text-emerald-300' : 'text-amber-300'}`}>{locationFreshness(volunteer.lastSeenAt)}</div>
                  {volunteer.name === activeVolunteerName && <div className="rounded border border-emerald-700 bg-emerald-950/70 px-2 py-1 text-[10px] font-bold text-emerald-300">YOU ARE ACTIVE · LIVE ON MAP</div>}
                  {volunteer.skills?.length > 0 && <div className="text-[11px] text-slate-400">Skills: {volunteer.skills.join(', ')}</div>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute bottom-4 right-4 z-[400] glass-panel p-3 rounded-xl text-xs space-y-1.5 border border-slate-800 shadow-xl pointer-events-auto">
          <div className="font-bold text-white text-[11px] border-b border-slate-800 pb-1 mb-1 flex items-center justify-between"><span>Emergency Map</span><span className="text-[9px] font-mono text-emerald-400">OpenStreetMap</span></div>
          <div className="flex items-center gap-2 text-slate-300"><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">!</span> Incident</div>
          <div className="flex items-center gap-2 text-slate-300"><span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" /> Live Resource</div>
          <div className="flex items-center gap-2 text-slate-300"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Volunteer</div>
        </div>
      </div>
    </div>
  );
}
