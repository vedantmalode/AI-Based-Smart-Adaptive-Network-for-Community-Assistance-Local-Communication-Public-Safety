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
import { getPendingOfflineQueue, processOfflineQueue } from '../services/offlineStore';
import { simulateBLERelayHop } from '../services/bleRelaySimulator';

export default function OfflineBLESyncPanel({ isOnline, setIsOnline, onReportSynced }) {
  const [pendingQueue, setPendingQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bleSimulationPacket, setBleSimulationPacket] = useState(null);

  // Load IndexedDB outbox queue
  const refreshQueue = async () => {
    try {
      const items = await getPendingOfflineQueue();
      setPendingQueue(items);
    } catch (e) {
      console.warn("IndexedDB queue access error:", e);
    }
  };

  useEffect(() => {
    refreshQueue();
  }, [isOnline]);

  const handleManualSync = async () => {
    if (!isOnline) {
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
            Tier 2 Store-and-Forward & Tier 3 BLE Mesh Engine
          </span>
          <h2 className="text-2xl font-heading font-extrabold text-white mt-1 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-400" />
            Resilient Offline Architecture & BLE Relay
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Guarantees emergency message transmission during cellular infrastructure collapse.
          </p>
        </div>

        {/* Connection Toggle */}
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg border ${
            isOnline 
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900' 
              : 'bg-red-950/90 text-red-300 border-red-700/80 pulse-critical hover:bg-red-900'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
          <span>{isOnline ? '🟢 NETWORK: ONLINE' : '🔴 NETWORK: OFFLINE (SIMULATED)'}</span>
        </button>
      </div>

      {/* TWO COLUMNS: INDEXEDDB QUEUE vs BLE MESH VISUALIZER */}
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
            Emergency reports created offline are stored client-side in browser IndexedDB. When uplink connection is detected, the Service Worker automatically flushes the queue.
          </p>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {pendingQueue.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                <HardDrive className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                IndexedDB Outbox Queue is Empty. All reports are synced to Cloud.
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

        {/* RIGHT COL: BLE Mesh Relay Simulator */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-400" />
              Bluetooth (BLE) Mesh P2P Relay Visualizer
            </h3>

            <button
              onClick={handleRunBLESimulation}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate BLE Relay Hop</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Simulates zero-cellular environment P2P mesh network hopping over Bluetooth Low Energy (~100m range per node) until reaching a gateway.
          </p>

          {!bleSimulationPacket ? (
            <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl space-y-2">
              <Radio className="w-8 h-8 mx-auto text-emerald-500 animate-pulse" />
              <div>Click "Simulate BLE Relay Hop" to visualize P2P multi-device emergency message packet propagation.</div>
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
