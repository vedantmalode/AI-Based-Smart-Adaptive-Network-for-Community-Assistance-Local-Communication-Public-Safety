import React, { useState } from 'react';
import { 
  AlertOctagon, 
  CheckCircle2, 
  Users, 
  Truck, 
  Clock, 
  Filter, 
  Search, 
  ChevronRight, 
  BrainCircuit, 
  ArrowUpDown, 
  History, 
  ShieldCheck,
  Edit3
} from 'lucide-react';

export default function IncidentTriageDashboard({ 
  incidents, 
  volunteers, 
  resources, 
  onUpdateStatus, 
  onSelectForDispatch 
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncidentForAudit, setSelectedIncidentForAudit] = useState(null);

  // Compute Command KPIs
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length;
  const activeCount = incidents.filter(i => i.status !== 'RESOLVED').length;
  const activeVolunteersCount = volunteers.filter(v => v.status === 'ACTIVE').length;
  const availableResourcesCount = resources.filter(r => r.status === 'AVAILABLE').length;

  const filteredIncidents = incidents.filter(inc => {
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && inc.severity !== priorityFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        inc.id.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.location.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {/* KPI Stats Command Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-red-500 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Critical Incidents</span>
            <AlertOctagon className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
          <div className="text-2xl font-extrabold text-white">{criticalCount}</div>
          <div className="text-[11px] text-red-400">Immediate Action Needed</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-amber-500 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Active Emergencies</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-white">{activeCount}</div>
          <div className="text-[11px] text-amber-400">In Lifecycle Pipeline</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-blue-500 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Available Volunteers</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-white">{activeVolunteersCount} / {volunteers.length}</div>
          <div className="text-[11px] text-blue-400">On-Call Ready</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-emerald-500 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Available Assets</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-white">{availableResourcesCount} / {resources.length}</div>
          <div className="text-[11px] text-emerald-400">Ambulances, Boats, Trucks</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-purple-500 space-y-1 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Avg Response ETA</span>
            <BrainCircuit className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">4.8 min</div>
          <div className="text-[11px] text-purple-300">AI Optimized Routing</div>
        </div>

      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search ID, category, keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">REPORTED</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="RESPONDING">RESPONDING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Main Triage Incident Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Incident ID & Category</th>
                <th className="p-4">Priority Score & AI Severity</th>
                <th className="p-4">Location & Headcount</th>
                <th className="p-4">Lifecycle Status</th>
                <th className="p-4 text-right">Command Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No incidents match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-900/40 transition-colors">
                    
                    {/* ID & Category */}
                    <td className="p-4">
                      <div className="font-mono text-[10px] text-slate-400">{inc.id}</div>
                      <div className="font-bold text-sm text-white">{inc.category}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{inc.description}</p>
                    </td>

                    {/* AI Severity & Confidence */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded font-extrabold text-[11px] ${
                          inc.severity === 'CRITICAL' ? 'badge-critical pulse-critical' :
                          inc.severity === 'HIGH' ? 'badge-high' : 'badge-medium'
                        }`}>
                          {inc.severity} ({inc.priorityScore}/100)
                        </span>
                      </div>
                      <div className="text-[10px] text-purple-300 mt-1 flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3 text-purple-400" />
                        AI Confidence: {Math.round(inc.confidence * 100)}%
                      </div>
                    </td>

                    {/* Location & Headcount */}
                    <td className="p-4">
                      <div className="text-white font-medium truncate max-w-[200px]">{inc.location.address}</div>
                      <div className="text-slate-400 text-[10px]">
                        👥 Affected: <strong className="text-white">{inc.peopleAffected}</strong> | 
                        Injured: <strong className={inc.injuries ? 'text-red-400' : 'text-slate-400'}>{inc.injuries ? 'YES' : 'NO'}</strong>
                      </div>
                    </td>

                    {/* Status Dropdown */}
                    <td className="p-4">
                      <select
                        value={inc.status}
                        onChange={(e) => onUpdateStatus(inc.id, e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-white font-semibold text-xs rounded-lg px-2.5 py-1.5 focus:border-blue-500 cursor-pointer"
                      >
                        <option value="REPORTED">REPORTED</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="ASSIGNED">ASSIGNED</option>
                        <option value="RESPONDING">RESPONDING</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectForDispatch(inc)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all shadow cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Dispatch</span>
                        </button>

                        <button
                          onClick={() => setSelectedIncidentForAudit(inc)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                          title="View Audit Timeline"
                        >
                          <History className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Timeline Drawer Modal */}
      {selectedIncidentForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel-accent max-w-md w-full h-full p-6 space-y-6 overflow-y-auto border-l border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-heading font-extrabold text-base text-white">Incident Audit History</h3>
                <span className="font-mono text-xs text-amber-400">{selectedIncidentForAudit.id}</span>
              </div>
              <button
                onClick={() => setSelectedIncidentForAudit(null)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 bg-slate-800 rounded"
              >
                Close ✕
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Step-by-step Audit Timeline</h4>
              
              <div className="relative border-l-2 border-slate-700 pl-4 space-y-6">
                {selectedIncidentForAudit.auditTimeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-950" />
                    <div className="text-[11px] font-mono text-amber-400">{item.time}</div>
                    <div className="text-xs font-bold text-white mt-0.5">{item.event}</div>
                    <div className="text-[11px] text-slate-400">By: {item.by}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
