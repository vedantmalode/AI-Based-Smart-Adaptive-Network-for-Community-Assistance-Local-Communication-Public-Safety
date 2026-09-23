import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Activity, Navigation, Radio, Truck, UserRound } from 'lucide-react';
import { NAGPUR_CENTER } from '../services/mockData';

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

export default function GISMapView({ resources, volunteers = [], activeVolunteerName }) {
  const [showResources, setShowResources] = useState(true);
  const [showVolunteers, setShowVolunteers] = useState(true);
  const activeVolunteers = volunteers.filter((volunteer) => volunteer.status === 'ACTIVE');
  const mapCenter = [NAGPUR_CENTER.lat, NAGPUR_CENTER.lng];

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-fade-in">
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-heading font-extrabold text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              Live Resource Map — Nagpur, Maharashtra
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" /> Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Track emergency vehicles, response resources, and active volunteers across the city.</p>
        </div>
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
      </div>

      <div className="relative h-[620px] w-full rounded-2xl overflow-hidden border border-slate-800 glass-panel shadow-2xl">
        <MapContainer center={mapCenter} zoom={13} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {showResources && resources.map((resource) => (
            <Marker key={resource.id} position={[resource.location.lat, resource.location.lng]} icon={LIVE_RESOURCE_ICON}>
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5"><Truck className="w-4 h-4" />{resource.name}</div>
                  <div className="text-[11px] text-slate-300">Type: {resource.type} | Status: <strong className="text-emerald-400">{resource.status}</strong></div>
                  {resource.isLiveTracking && <div className="bg-emerald-950/80 p-1.5 rounded border border-emerald-800 text-[10px] font-mono text-emerald-300 flex items-center justify-between"><span className="flex items-center gap-1"><Radio className="w-3 h-3 text-emerald-400 animate-pulse" />Live GPS Active</span><span>Speed: {resource.speedKmH} km/h</span></div>}
                  <div className="text-[11px] text-slate-400">Owner: {resource.ownerOrg}</div>
                  <div className="text-[11px] text-slate-400">Details: {resource.details}</div>
                </div>
              </Popup>
            </Marker>
          ))}
          {showVolunteers && activeVolunteers.map((volunteer) => (
            <Marker key={volunteer.id} position={[volunteer.location.lat, volunteer.location.lng]} icon={VOLUNTEER_ICON}>
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5"><UserRound className="w-4 h-4" />{volunteer.name}</div>
                  <div className="text-[11px] text-slate-300">Status: <strong className={volunteer.status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-300'}>{volunteer.status}</strong></div>
                  <div className="text-[11px] text-slate-400">Volunteer ID: {volunteer.id}</div>
                  {volunteer.name === activeVolunteerName && <div className="rounded border border-emerald-700 bg-emerald-950/70 px-2 py-1 text-[10px] font-bold text-emerald-300">YOU ARE ACTIVE · LIVE ON MAP</div>}
                  <div className="text-[11px] text-slate-400">Skills: {volunteer.skills.join(', ')}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute bottom-4 right-4 z-[400] glass-panel p-3 rounded-xl text-xs space-y-1.5 border border-slate-800 shadow-xl pointer-events-auto">
          <div className="font-bold text-white text-[11px] border-b border-slate-800 pb-1 mb-1 flex items-center justify-between"><span>Resource Map</span><span className="text-[9px] font-mono text-emerald-400">OSM Live</span></div>
          <div className="flex items-center gap-2 text-slate-300"><span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" /> Live Resource</div>
          <div className="flex items-center gap-2 text-slate-300"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Volunteer</div>
        </div>
      </div>
    </div>
  );
}
