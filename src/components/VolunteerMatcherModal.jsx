import React, { useState } from 'react';
import {
  Users, 
  ShieldCheck, 
  Truck, 
  MapPin, 
  Navigation, 
  Send,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { VOLUNTEER_TYPES } from '../services/roleConfig';
import { DEFAULT_VOLUNTEER_MATCH_WEIGHTS, isVolunteerAvailable, isVolunteerVerified, matchVolunteersForIncident, matchResourcesForIncident } from '../services/geoMatcher';

export default function VolunteerMatcherModal({ incident, volunteers, resources, onAssignDispatch, onClose }) {
  const [selectedVolunteerId, setSelectedVolunteerId] = useState(null);
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [weights, setWeights] = useState({ ...DEFAULT_VOLUNTEER_MATCH_WEIGHTS });

  const rankedVolunteers = matchVolunteersForIncident(incident, volunteers, weights);
  const rankedResources = matchResourcesForIncident(incident, resources);

  const handleConfirmDispatch = () => {
    if (!selectedVolunteerId && !selectedResourceId) {
      alert("Please select at least one volunteer or resource to dispatch.");
      return;
    }

    const assignedVol = rankedVolunteers.find(({ volunteer }) => volunteer.id === selectedVolunteerId)?.volunteer;
    const assignedRes = resources.find(r => r.id === selectedResourceId);
    if ((selectedVolunteerId && !assignedVol) || (selectedResourceId && !assignedRes)) {
      alert('The selected responder or resource is no longer in the current roster. Refresh the recommendations.');
      return;
    }
    if (assignedVol && (!isVolunteerVerified(assignedVol) || !isVolunteerAvailable(assignedVol))) {
      alert('Select a verified responder who is currently available.');
      return;
    }
    if (assignedRes && assignedRes.status !== 'AVAILABLE') {
      alert('Select a resource that is currently available.');
      return;
    }

    onAssignDispatch({
      incidentId: incident.id,
      volunteer: assignedVol,
      resource: assignedRes
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-accent max-w-3xl w-full max-h-[90vh] flex flex-col rounded-2xl border border-blue-500/40 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-white">Responder & Resource Recommendations</h3>
              <p className="text-xs text-slate-400 font-mono">Incident ID: {incident.id} ({incident.category})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded text-xs font-bold">
            Close ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Incident Summary Card */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">Target Location:</div>
              <div className="font-bold text-sm text-white flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-4 h-4 text-red-400" />
                {incident.location.address}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-red-950 text-red-300 border border-red-800 font-extrabold text-xs">
                {incident.priorityBand ? `${incident.priorityBand} · ` : ''}{incident.severity} ({incident.priorityScore}/100)
              </span>
            </div>
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white"><SlidersHorizontal className="h-4 w-4 text-sky-300" />Recommendation weights</h4>
            <p className="mt-1 text-[11px] text-slate-400">Adjust distance, relevant skills, and availability. Values are normalized to score each candidate; the dispatcher still chooses the final assignment.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">{[
              ['distance', 'Distance'], ['skills', 'Relevant skills'], ['availability', 'Availability'],
            ].map(([key, label]) => <label key={key} className="text-[11px] font-semibold text-slate-300">{label} <span className="float-right text-sky-200">{weights[key]}%</span><input aria-label={`${label} matching weight`} type="range" min="0" max="100" value={weights[key]} onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} className="mt-1 w-full accent-sky-500" /></label>)}</div>
          </section>

          {/* SECTION 1: RANKED VOLUNTEERS */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-sm text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              1. Approved responders ranked by fit
            </h4>
            <p className="text-[11px] text-slate-400">Only Management-approved responder accounts appear. Available responders rank first; unavailable responders are shown for context and cannot be selected. Listed skills guide the match; verify qualifications and dispatch eligibility before assignment.</p>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {rankedVolunteers.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  No Management-approved responders with a shared location were found within their service radius.
                </div>
              ) : (
                rankedVolunteers.map(({ volunteer, distanceKm, etaMinutes, skillMatchScore, matchedSkills, requiredSkills, compositeScore, scoreBreakdown, available }) => {
                  const isSelected = selectedVolunteerId === volunteer.id;
                  return (
                    <div
                      key={volunteer.id}
                      onClick={() => available && setSelectedVolunteerId(volunteer.id)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${!available ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                        isSelected
                          ? 'bg-blue-950/80 border-blue-500 shadow-md shadow-blue-900/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{volunteer.name}</span>
                          <span className="text-[10px] font-bold bg-emerald-950 px-2 py-0.5 rounded text-emerald-200 border border-emerald-800">
                            <ShieldCheck className="mr-1 inline h-3 w-3" />Management approved
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${available ? 'bg-emerald-950 text-emerald-200 border-emerald-800' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{available ? 'Available' : volunteer.availability || volunteer.status || 'Unavailable'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Skills: <strong className="text-slate-200">{Array.isArray(volunteer.skills) && volunteer.skills.length ? volunteer.skills.join(', ') : 'Not listed'}</strong></span>
                          {volunteer.vehicle && <span>Vehicle: <strong className="text-slate-200">{volunteer.vehicle}</strong></span>}
                          {volunteer.volunteerType && <span className="text-cyan-300">Unit: <strong>{VOLUNTEER_TYPES[volunteer.volunteerType]?.shortLabel || 'Volunteer'}</strong></span>}
                          <span className="basis-full">Relevant skills: <strong className={matchedSkills.length ? 'text-emerald-200' : 'text-amber-200'}>{matchedSkills.length ? matchedSkills.join(', ') : `No match from ${requiredSkills.join(', ')}`}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-bold text-emerald-400">{distanceKm} km away</div>
                          <div className="text-[10px] text-slate-400 font-mono">ETA ~{etaMinutes} min</div>
                        </div>

                        <div className="px-3 py-1 bg-slate-950 rounded border border-slate-700 text-center">
                          <div className="text-[10px] text-slate-400 font-mono">Fit Score</div>
                          <div className="text-xs font-black text-amber-400">{compositeScore}%</div>
                          <div className="mt-1 text-[9px] text-slate-500">D {scoreBreakdown.distance} · S {scoreBreakdown.skills} · A {scoreBreakdown.availability}</div>
                        </div>

                        <input
                          type="radio"
                          name="volunteer"
                          checked={isSelected}
                          disabled={!available}
                          onChange={() => setSelectedVolunteerId(volunteer.id)}
                          className="accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 2: RECOMMENDED EMERGENCY RESOURCES */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-sm text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              2. Recommended Emergency Assets & Equipment
            </h4>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {rankedResources.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  No available equipment units found in area.
                </div>
              ) : (
                rankedResources.map(({ resource, distanceKm, etaMinutes, isNeededType }) => {
                  const isSelected = selectedResourceId === resource.id;
                  return (
                    <div
                      key={resource.id}
                      onClick={() => setSelectedResourceId(resource.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-950/80 border-emerald-500 shadow-md shadow-emerald-900/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{resource.name}</span>
                          {isNeededType && (
                            <span className="text-[9px] font-bold uppercase bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">
                              Target Asset Match
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{resource.details} | Org: {resource.ownerOrg}</div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-400">{distanceKm} km</div>
                          <div className="text-[10px] text-slate-400 font-mono">ETA ~{etaMinutes} min</div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedResourceId(isSelected ? null : resource.id)}
                          className="accent-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDispatch}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-blue-900/40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>CONFIRM DISPATCH & NOTIFY UNITS</span>
          </button>
        </div>

      </div>
    </div>
  );
}
