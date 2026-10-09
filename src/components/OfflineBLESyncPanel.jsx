import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Database, 
  Share2, 
  CheckCircle2, 
  ShieldAlert, 
  Smartphone, 
  Server, 
  Zap,
  HardDrive
} from 'lucide-react';
import { getPendingIncidentUpdates, getPendingOfflineQueue, processOfflineQueue } from '../services/offlineStore';
import { simulateBLERelayHop } from '../services/bleRelaySimulator';

export default function OfflineBLESyncPanel({ isOnline, onReportSynced }) {
  const [pendingQueue, setPendingQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bleSimulationPacket, setBleSimulationPacket] = useState(null);
  const [nativeBleStatus, setNativeBleStatus] = useState(null);
  const hasNativeBle = typeof window !== 'undefined' && Boolean(window.ResQNetNative?.startBleMesh);

  const refreshNativeBleStatus = () => {
    if (!window.ResQNetNative?.bleStatus) return;
    try {
      setNativeBleStatus(JSON.parse(window.ResQNetNative.bleStatus()));
    } catch {
      setNativeBleStatus({ running: false, error: 'Unable to read native BLE status.' });
    }
  };

  const handleToggleNativeBle = () => {
    if (!window.ResQNetNative) return;
    try {
      const current = JSON.parse(window.ResQNetNative.bleStatus());
      const result = current.running
        ? window.ResQNetNative.stopBleMesh()
        : window.ResQNetNative.startBleMesh();
      setNativeBleStatus(JSON.parse(result));
    } catch {
      setNativeBleStatus({ running: false, error: 'Could not control native BLE relay.' });
    }
  };

  // Load IndexedDB outbox queue
  const refreshQueue = async () => {
    try {
      const items = await getPendingOfflineQueue();
      const updates = await getPendingIncidentUpdates();
      setPendingQueue([...items, ...updates].sort((a, b) => (Number(b.priorityScore || b.incident?.priorityScore) || 0) - (Number(a.priorityScore || a.incident?.priorityScore) || 0)
        || new Date(a.createdAt) - new Date(b.createdAt)));
    } catch (e) {
      console.warn("IndexedDB queue access error:", e);
    }
  };

  useEffect(() => {
    refreshQueue();
  }, [isOnline]);

  useEffect(() => {
    const handleRelayedIncident = () => refreshQueue();
    window.addEventListener('resqnet:incident', handleRelayedIncident);
    return () => window.removeEventListener('resqnet:incident', handleRelayedIncident);
  }, []);

  useEffect(() => {
    if (!hasNativeBle) return undefined;
    refreshNativeBleStatus();
    const timer = setInterval(refreshNativeBleStatus, 2000);
    const handleStatus = (event) => setNativeBleStatus(event.detail);
    window.addEventListener('resqnet:ble-status', handleStatus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resqnet:ble-status', handleStatus);
    };
  }, [hasNativeBle]);

  const handleManualSync = async () => {
    if (!isOnline && !hasNativeBle) {
      alert("Network is currently OFFLINE. Toggle connection to ONLINE first to trigger cloud synchronization.");
      return;
    }
    setIsSyncing(true);
    await processOfflineQueue(onReportSynced);
    await refreshQueue();
    setIsSyncing(false);
  };

  const handleRunBLESimulation = () => {
    const sampleIncident = {
      id: "INC-OFFLINE-BLE-99",
      clientUuid: "client-uuid-ble-mesh-99",
      category: "Road Accident",
      title: "P2P BLE SOS Packet",
      description: "Zero cellular connectivity scenario. Message relayed via BLE mesh hops.",
      peopleAffected: 3,
      location: { lat: 19.0760, lng: 72.8777, address: "Remote Highway Blackout Zone" }
    };

    const packet = simulateBLERelayHop(sampleIncident);
    setBleSimulationPacket(packet);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold rounded-full uppercase tracking-wider">
            Local communication prototype · Offline store-and-forward
          </span>
          <h2 className="text-2xl font-heading font-extrabold text-white mt-1 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-400" />
            Local Connect & Offline Mode
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {hasNativeBle
              ? 'Android devices advertise and scan for nearby AI-Based responder phones, then relay queued SOS reports over BLE.'
              : 'Pending reports sync to the AI-Based API when it is reachable. Phone-to-phone Bluetooth relay is available in the Android companion; this browser provides a clearly labeled simulator.'}
          </p>
        </div>

        {/* Connection Toggle */}
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border ${
            isOnline 
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900' 
              : 'bg-red-950/90 text-red-300 border-red-700/80 hover:bg-red-900'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
          <span>{isOnline ? '🟢 NETWORK: ONLINE' : '🔴 NETWORK: OFFLINE'}</span>
        </div>
        {hasNativeBle && (
          <button onClick={handleToggleNativeBle} className="rounded-xl border border-cyan-500/50 bg-cyan-950/60 px-4 py-2.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-900/70">
            {nativeBleStatus?.running ? 'Stop nearby volunteer relay' : 'Start nearby volunteer relay'}
          </button>
        )}
        {hasNativeBle && <span className="text-[10px] text-slate-400">{nativeBleStatus?.error || (nativeBleStatus?.running ? `BLE mesh active · ${nativeBleStatus.peerCount || 0} peers` : 'BLE mesh stopped')}</span>}
      </div>

      {/* TWO COLUMNS: INDEXEDDB QUEUE vs BLE MESH ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COL: IndexedDB Store-and-Forward Outbox */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              IndexedDB Store-and-Forward Outbox ({pendingQueue.length})
            </h3>

            <button
              onClick={handleManualSync}
              disabled={isSyncing || pendingQueue.length === 0}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Queue Now'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {hasNativeBle
              ? 'Offline reports are handed to the Android incident store and BLE relay when you press Sync Queue Now.'
              : 'Emergency reports created offline are stored in browser IndexedDB. When the API server is reachable, use Sync Queue Now to send them.'}
          </p>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {pendingQueue.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                <HardDrive className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            No offline reports are waiting to sync to the incident service.
              </div>
            ) : (
              pendingQueue.map((item) => (
                <div key={item.id} className="glass-card p-4 space-y-2 border-l-4 border-l-amber-500">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-amber-400 font-bold">{item.clientUuid}</span>
                    <span className="px-2 py-0.5 bg-amber-950 text-amber-300 text-[10px] font-bold rounded border border-amber-800">
                      {item.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs text-white">{item.category}: {item.title}</h4>
                  <p className="text-[11px] text-slate-300">{item.description}</p>
                  <div className="text-[10px] text-slate-500 font-mono pt-1">
                    Logged: {new Date(item.createdAt).toLocaleTimeString()} | Retries: {item.retryCount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COL: live Android relay status or clearly labeled browser visualization */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              {hasNativeBle ? <Radio className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5 text-emerald-400" />}
              {hasNativeBle ? 'Live Bluetooth relay' : 'Browser relay walkthrough'}
            </h3>

            {!hasNativeBle && <button
                onClick={handleRunBLESimulation}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Show sample hops</span>
              </button>}
          </div>

          <p className="text-xs text-slate-400">
            {hasNativeBle
              ? 'This is live device status. Create or sync a report on this Android phone; it is queued locally and sent to nearby ResQNet phones over Bluetooth. Received reports are saved on the receiving phone and forwarded with a hop limit.'
              : 'This walkthrough is illustrative and does not transmit Bluetooth. For a real relay, open the Android companion on nearby phones, grant Bluetooth permissions, and start the nearby volunteer relay on each phone.'}
          </p>

          {hasNativeBle ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Relay', nativeBleStatus?.running ? 'Listening' : 'Stopped'],
                  ['Nearby devices', nativeBleStatus?.peerCount ?? 0],
                  ['Relay cache', nativeBleStatus?.queuedPackets ?? 0],
                  ['BLE received', nativeBleStatus?.receivedPackets ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="glass-card rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-bold text-white">{value}</div>
                  </div>
                ))}
              </div>
              <div className="glass-card rounded-xl p-3 text-xs text-slate-300">
                <div className="font-bold text-white">How a report travels</div>
                <ol className="mt-2 space-y-1 list-decimal list-inside">
                  <li>Save an emergency report; Android adds it to the relay cache.</li>
                  <li>Nearby phones discover each other and exchange packet frames over BLE.</li>
                  <li>Each phone checks the message ID to avoid duplicates, saves new reports, then forwards them while hops remain.</li>
                  <li>When internet is available, use Sync Queue Now to submit received reports to the incident service.</li>
                </ol>
                <div className="mt-3 border-t border-slate-700 pt-2 text-slate-400">
                  {nativeBleStatus?.error || nativeBleStatus?.lastEvent || 'Waiting for a nearby device or a queued report.'}
                  {nativeBleStatus?.lastEventAt ? ` · ${new Date(nativeBleStatus.lastEventAt).toLocaleTimeString()}` : ''}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">Sent data frames: {nativeBleStatus?.sentFrames ?? 0}. A connection alone does not confirm end-to-end delivery.</div>
              </div>
              <div className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-white">Message delivery status</h4><span className="text-[10px] text-slate-500">Pending {nativeBleStatus?.pendingPackets ?? 0} · Relayed {nativeBleStatus?.relayedPackets ?? 0} · Server confirmed {nativeBleStatus?.serverConfirmedPackets ?? 0}</span></div>
                {(nativeBleStatus?.deliveryStatuses || []).length === 0 ? <p className="text-[11px] text-slate-500">No signed Android relay packets yet.</p> : <div className="space-y-1.5">{nativeBleStatus.deliveryStatuses.map((delivery) => {
                  const statusCopy = {
                    PENDING: ['Pending nearby receipt', 'text-amber-200 border-amber-500/30 bg-amber-950/30'],
                    RELAYED: ['Received by a nearby phone', 'text-cyan-200 border-cyan-500/30 bg-cyan-950/30'],
                    SERVER_CONFIRMED: ['Incident API confirmed', 'text-emerald-200 border-emerald-500/30 bg-emerald-950/30'],
                    EXPIRED: ['Expired', 'text-slate-300 border-slate-600 bg-slate-900'],
                    HOP_LIMIT_REACHED: ['Hop limit reached', 'text-orange-200 border-orange-500/30 bg-orange-950/30'],
                    INVALID_SIGNATURE: ['Rejected: invalid signature', 'text-red-200 border-red-500/30 bg-red-950/30'],
                    QUEUE_LIMIT_REACHED: ['Removed: local queue full', 'text-orange-200 border-orange-500/30 bg-orange-950/30'],
                  }[delivery.status] || [delivery.status, 'text-slate-300 border-slate-600 bg-slate-900'];
                  return <div key={delivery.messageId} className="flex flex-wrap items-center justify-between gap-2 text-[10px]"><span className="font-mono text-slate-400">{delivery.messageId}</span><span className={`rounded-full border px-2 py-0.5 ${statusCopy[1]}`}>{statusCopy[0]}</span></div>;
                })}</div>}
                <p className="border-t border-slate-700 pt-2 text-[10px] leading-4 text-amber-200/80">A BLE receipt means only that a nearby ResQNet phone accepted the packet. “Incident API confirmed” means the app server stored it. Neither status confirms that emergency services received or dispatched help.</p>
                <p className="text-[10px] leading-4 text-slate-500">Packet signatures detect alteration after signing. The included origin key is self-asserted; it does not independently verify a reporter’s identity.</p>
              </div>
            </div>
          ) : !bleSimulationPacket ? (
            <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl space-y-2">
              <Radio className="w-8 h-8 mx-auto text-emerald-500" />
              <div>Click “Show sample hops” to view the packet path. It is an illustration only; use the Android companion for real BLE transfer.</div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {/* Packet Metadata Card */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Packet Hash:</span>
                  <span className="text-emerald-400 font-bold">{bleSimulationPacket.payloadHash}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Hops Allowed:</span>
                  <span className="text-white">{bleSimulationPacket.maxHops} Hops (TTL: {bleSimulationPacket.ttlSeconds}s)</span>
                </div>
              </div>

              {/* Hop Step-by-Step Trace */}
              <div className="relative border-l-2 border-emerald-500/50 pl-4 space-y-4">
                {bleSimulationPacket.hops.map((hop) => (
                  <div key={hop.step} className="glass-card p-3 space-y-1 relative">
                    <div className="absolute -left-[23px] top-3 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-sm" />
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-emerald-400 font-bold">HOP #{hop.step}: {hop.nodeId}</span>
                      <span className="text-slate-500">{hop.timestamp}</span>
                    </div>
                    <div className="font-bold text-xs text-white">{hop.nodeType}</div>
                    <div className="text-[11px] text-slate-300 leading-tight">{hop.action}</div>
                    <div className="text-[10px] text-slate-500 font-mono pt-0.5">Signal Strength: {hop.signalStrength}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
