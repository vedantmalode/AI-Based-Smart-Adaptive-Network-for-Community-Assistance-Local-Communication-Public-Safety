import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BrainCircuit, MapPin, Radio, ShieldCheck, UsersRound } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const slides = [
  {
    eyebrow: 'COMMUNITY SAFETY NETWORK',
    title: 'Stay connected during emergencies',
    description: 'Report an incident, share your location, and keep track of the help coming your way.',
    icon: ShieldCheck,
    accent: 'red',
    points: ['One clear place to ask for help', 'Location shared with your report'],
  },
  {
    eyebrow: 'DECISION SUPPORT',
    title: 'AI-powered emergency response',
    description: 'The AI-Based network can organize incident details and suggest priorities for responders to review.',
    icon: BrainCircuit,
    accent: 'blue',
    points: ['Recommendations are reviewed by authorities', 'Priority includes a plain-language reason'],
  },
  {
    eyebrow: 'LOCAL RESPONSE',
    title: 'Community-powered safety',
    description: 'Coordinate citizens, trained volunteers, authorities, and nearby resources around a shared incident update.',
    icon: UsersRound,
    accent: 'green',
    points: ['Find nearby response support', 'Offline tools are clearly marked as prototypes'],
  },
];

export default function WelcomeOnboarding({ onComplete, onOpenLogin }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const slide = slides[step];
  const Icon = slide.icon;

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onComplete(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto bg-[#090d16] text-slate-100" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight text-white">AI-Based</span>
          </div>
          <button type="button" onClick={onComplete} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">{t('Skip')}</button>
        </header>

        <main className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <section className="order-2 mx-auto w-full max-w-xl lg:order-1">
            <p className="text-xs font-extrabold tracking-[0.18em] text-slate-400">{t(slide.eyebrow)}</p>
            <h1 id="welcome-title" className="mt-4 max-w-lg text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl" aria-live="polite">{t(slide.title)}</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">{t(slide.description)}</p>
            <ul className="mt-6 space-y-3">
              {slide.points.map((point) => <li key={point} className="flex items-center gap-3 text-sm font-medium text-slate-200"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-950 text-emerald-300">✓</span>{t(point)}</li>)}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)} aria-label={t('Previous introduction screen')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 text-sm font-bold text-slate-200 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />{t('Back')}</button>}
              <button type="button" onClick={() => step === slides.length - 1 ? onComplete() : setStep((current) => current + 1)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-extrabold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500">
                {t(step === slides.length - 1 ? 'Get started' : 'Next')} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2" role="group" aria-label={`Screen ${step + 1} of ${slides.length}`}>
                {slides.map((item, index) => <button key={item.eyebrow} type="button" onClick={() => setStep(index)} aria-label={`Go to screen ${index + 1}`} aria-current={index === step ? 'step' : undefined} className={`h-2.5 rounded-full transition-all ${index === step ? 'w-8 bg-red-500' : 'w-2.5 bg-slate-700'}`} />)}
              </div>
              <button type="button" onClick={onOpenLogin} className="min-h-11 text-sm font-bold text-sky-300 hover:text-sky-200">{t('Already have an account? Sign in')}</button>
            </div>
          </section>

          <section className="order-1 mx-auto flex min-h-[260px] w-full max-w-md items-center justify-center lg:order-2 lg:min-h-[420px]" aria-hidden="true">
            <div className="relative flex aspect-square w-full max-w-[360px] items-center justify-center rounded-[2rem] border border-slate-800 bg-slate-900 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
              <div className={`absolute inset-5 rounded-[1.6rem] ${slide.accent === 'red' ? 'bg-red-950/35' : slide.accent === 'blue' ? 'bg-blue-950/35' : 'bg-emerald-950/35'}`} />
              <div className="absolute left-[17%] top-[20%] flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-sky-300"><MapPin className="h-6 w-6" /></div>
              <div className={`relative flex h-36 w-36 items-center justify-center rounded-full border-[10px] bg-slate-950 ${slide.accent === 'red' ? 'border-red-900 text-red-400' : slide.accent === 'blue' ? 'border-blue-900 text-blue-400' : 'border-emerald-900 text-emerald-400'}`}>
                <span className="absolute inset-2 rounded-full border border-slate-800" /><Icon className="relative h-14 w-14" strokeWidth={1.7} />
              </div>
              <div className="absolute bottom-[19%] right-[14%] flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200"><Radio className="h-4 w-4 text-emerald-400" /> {t('Response network')}</div>
              <span className="absolute right-[23%] top-[19%] h-3 w-3 rounded-full bg-red-500 ring-4 ring-red-950" />
            </div>
          </section>
        </main>

        <footer className="flex items-center justify-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-400"><ShieldCheck className="h-4 w-4" /> {t('Location and responder access follow your account permissions.')}</footer>
      </div>
    </div>
  );
}
