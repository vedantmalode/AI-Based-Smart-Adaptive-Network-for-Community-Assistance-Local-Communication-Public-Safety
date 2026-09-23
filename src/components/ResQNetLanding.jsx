import React from 'react';
import {
  Activity,
  CheckCircle2,
  MapPinned,
  ShieldAlert,
  Waves,
} from 'lucide-react';

const heroImage = 'https://assets-global.website-files.com/65980f04e623a6d3c4889edc/65a65b4959e5e692f4f58621_65329fd510aedbb695cd40f4_Disaster-response-relief-nonprofit-to-donate-to.jpeg';

const capabilities = [
  { icon: MapPinned, title: 'Live resource locations', text: 'Track emergency vehicles and response resources on a city map.', accent: 'text-sky-300 bg-sky-500/10 border-sky-400/20' },
  { icon: Activity, title: 'Response readiness', text: 'Keep a clear view of available resources and network status.', accent: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20' },
];

export default function ResQNetLanding({ onOpenMap }) {
  return (
    <div className="landing-page mx-auto max-w-7xl pb-10">
      <section className="landing-hero relative overflow-hidden rounded-3xl border border-slate-700/70">
        <img src={heroImage} alt="Emergency responders coordinating a rescue operation" className="landing-hero-image" />
        <div className="landing-hero-overlay" />
        <div className="landing-grid" aria-hidden="true" />
        <div className="landing-orb landing-orb-one" aria-hidden="true" />
        <div className="landing-orb landing-orb-two" aria-hidden="true" />

        <div className="relative z-10 grid min-h-[620px] items-end gap-10 p-6 sm:p-10 lg:grid-cols-[1.25fr_.75fr] lg:p-14">
          <div className="animate-rise">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-950/50 px-3 py-1.5 text-xs font-bold tracking-[0.16em] text-red-100 backdrop-blur-md">
              <span className="live-dot" /> LIVE-READY EMERGENCY COORDINATION
            </div>
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-sky-200">Nagpur, Maharashtra · Public safety network</p>
            <h1 className="max-w-3xl font-heading text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Every second deserves a <span className="text-red-400">coordinated</span> response.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              ResQNet helps teams monitor emergency resources and maintain coordination across Nagpur.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={onOpenMap} className="landing-secondary">
                <MapPinned className="h-5 w-5 text-sky-300" /> Explore live map
              </button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-200">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Live resource locations</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Network status at a glance</span>
            </div>
          </div>

          <aside className="landing-status-card animate-rise-delay" aria-label="Live network summary">
            <div className="flex items-start justify-between border-b border-white/10 pb-5">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400">NETWORK STATUS</p>
                <p className="mt-1 text-lg font-bold text-white">Response grid online</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300"><span className="status-dot" /> LIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-3 py-5">
              <div className="landing-metric"><Waves className="h-4 w-4 text-amber-300" /><strong>12</strong><span>Resources ready</span></div>
              <div className="landing-metric"><ShieldAlert className="h-4 w-4 text-emerald-300" /><strong>4.8m</strong><span>Avg. response</span></div>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 py-10 md:grid-cols-3">
        {capabilities.map(({ icon: Icon, title, text, accent }, index) => (
          <article className="landing-capability animate-card-in" style={{ animationDelay: `${index * 120}ms` }} key={title}>
            <div className={`mb-5 inline-flex rounded-xl border p-3 ${accent}`}><Icon className="h-6 w-6" /></div>
            <h2 className="font-heading text-xl font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
