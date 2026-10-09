import React from 'react';
import { CheckCircle2, Radio, Wifi, WifiOff } from 'lucide-react';

const DELIVERY_COPY = {
  READY: ['Ready to report', 'border-slate-700 bg-slate-900 text-slate-300'],
  QUEUED: ['Queued on this device', 'border-amber-700 bg-amber-950/60 text-amber-200'],
  RELAYING: ['Received by nearby phone · relay may continue', 'border-cyan-700 bg-cyan-950/50 text-cyan-200'],
  SERVER_RECEIVED: ['Server received report', 'border-emerald-700 bg-emerald-950/50 text-emerald-200'],
};

/** Shows network reachability separately from the report's delivery progress. */
export default function CitizenConnectivityIndicator({ isOnline, deliveryStatus = 'READY' }) {
  const delivery = DELIVERY_COPY[deliveryStatus] || DELIVERY_COPY.READY;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite" aria-label="Connection and report delivery status">
      <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold ${isOnline ? 'border-emerald-800 bg-emerald-950/50 text-emerald-200' : 'border-amber-800 bg-amber-950/50 text-amber-200'}`}>
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{isOnline ? 'Online' : 'Offline'}
      </span>
      <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold ${delivery[1]}`}>
        {deliveryStatus === 'SERVER_RECEIVED' ? <CheckCircle2 className="h-4 w-4" /> : deliveryStatus === 'RELAYING' ? <Radio className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
        {delivery[0]}
      </span>
    </div>
  );
}
