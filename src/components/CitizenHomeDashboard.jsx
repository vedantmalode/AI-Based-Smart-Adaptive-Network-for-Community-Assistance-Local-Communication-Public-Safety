import React, { useEffect, useState } from 'react';
import { Ambulance, CarFront, CheckCircle2, Flame, MapPin, PhoneCall, Radio, ShieldAlert, Waves, X, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import CitizenConnectivityIndicator from './CitizenConnectivityIndicator';

const categories = [
  { id: 'Road Accident', label: 'Accident', icon: CarFront, tone: 'amber' },
  { id: 'Fire', label: 'Fire', icon: Flame, tone: 'red' },
  { id: 'Medical Emergency', label: 'Medical', icon: Ambulance, tone: 'rose' },
  { id: 'Flood', label: 'Flood', icon: Waves, tone: 'blue' },
  { id: 'Earthquake', label: 'Earthquake', icon: Zap, tone: 'violet' },
  { id: 'Other', label: 'Other', icon: ShieldAlert, tone: 'slate' },
];

const tones = {
  amber: 'bg-amber-950/50 text-amber-300 border-amber-800/70',
  red: 'bg-red-950/50 text-red-300 border-red-800/70',
  rose: 'bg-rose-950/50 text-rose-300 border-rose-800/70',
  blue: 'bg-blue-950/50 text-blue-300 border-blue-800/70',
  violet: 'bg-violet-950/50 text-violet-300 border-violet-800/70',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
};

export default function CitizenHomeDashboard({ userSession, isOnline, reports = [], onCreateReport, onQuickReport, onOpenReports }) {
  const { t } = useLanguage();
  // Home-screen state for GPS, one-tap SOS confirmation, and delivery feedback.
  const [location, setLocation] = useState(null);
  const [locationState, setLocationState] = useState('loading');
  const [locationError, setLocationError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [seconds, setSeconds] = useState(3);
  const [category, setCategory] = useState('Other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('READY');
  const [trackedReportId, setTrackedReportId] = useState('');
  const displayName = userSession?.name?.trim().split(/\s+/)[0] || 'there';

  // Get a high-accuracy location fix and keep its accuracy and capture time.
  const locate = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationState('unavailable');
      setLocationError(t('Location is not supported by this browser.'));
      return;
    }
    setLocationState('loading');
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setLocation({
        lat: latitude,
        lng: longitude,
        accuracy: Math.round(accuracy),
        address: `GPS location captured · ±${Math.round(accuracy)} m`,
        capturedAt: new Date().toISOString(),
        source: 'gps',
      });
      setLocationState('ready');
    }, (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? t('Location permission is off. Allow location access, or add a location in the report form.')
        : t('Could not get your location. Retry or add it in the report form.');
      setLocation(null);
      setLocationState('unavailable');
      setLocationError(message);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  };

  // Request location once when the citizen dashboard first opens.
  useEffect(() => { locate(); }, []);

  // Listen for the Android relay's receipt and server-confirmation updates.
  useEffect(() => {
    const handleBleStatus = (event) => {
      if (!trackedReportId) return;
      const report = (event.detail?.deliveryStatuses || []).find((item) => item.messageId === trackedReportId);
      if (report?.status === 'SERVER_CONFIRMED') setDeliveryStatus('SERVER_RECEIVED');
      else if (report?.status === 'RELAYED') setDeliveryStatus('RELAYING');
    };
    window.addEventListener('resqnet:ble-status', handleBleStatus);
    return () => window.removeEventListener('resqnet:ble-status', handleBleStatus);
  }, [trackedReportId]);

  // Reflect reports that finish syncing after the device reconnects.
  useEffect(() => {
    if (!trackedReportId) return;
    const report = reports.find((item) => item.clientUuid === trackedReportId);
    if (report && !['PENDING_SYNC', 'QUEUED', 'RELAYING'].includes(report.status)) setDeliveryStatus('SERVER_RECEIVED');
  }, [reports, trackedReportId]);

  // Count down before enabling the final one-tap SOS confirmation.
  useEffect(() => {
    if (!showConfirm || seconds <= 0) return undefined;
    const timeout = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [showConfirm, seconds]);

  // Reset confirmation state every time the citizen opens the SOS dialog.
  const openSosConfirmation = () => {
    setSeconds(3);
    setSubmitMessage('');
    setShowConfirm(true);
  };

  // Send the prepared SOS and display whether it is queued or server-received.
  const submitSos = async () => {
    if (!location || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await onQuickReport({
        category,
        title: `${category} SOS alert`,
        description: 'SOS alert. The citizen is requesting emergency assistance.',
        peopleAffected: 1,
        injuries: false,
        trapped: false,
        firePresent: false,
        location,
        media: [],
      });
      setShowConfirm(false);
      setSubmitMessage(result?.queued ? t('SOS saved and waiting to sync.') : t('SOS sent. You can view updates in your reports.'));
      setTrackedReportId(result?.clientUuid || '');
      setDeliveryStatus(result?.queued ? 'QUEUED' : 'SERVER_RECEIVED');
    } catch (error) {
      setSubmitMessage(error?.message || t('The SOS could not be sent. Open the full report and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the quick SOS card, location details, categories, and recent reports.
  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10 text-slate-100 animate-fade-in">
      {/* Account greeting, connectivity state, and direct emergency-number access. */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">{t('Your community response network')}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t('Hello')}, {displayName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2"><CitizenConnectivityIndicator isOnline={isOnline} deliveryStatus={deliveryStatus} /><a href="tel:112" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-700 bg-red-950/70 px-4 text-sm font-extrabold text-red-100 hover:bg-red-900"><PhoneCall className="h-4 w-4" />Call 112</a></div>
      </header>

      {/* Main SOS action beside the live location details. */}
      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-red-900/60 bg-slate-900/80 p-6 shadow-[0_12px_38px_rgba(0,0,0,.18)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-red-950/40" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-950/60 px-3 py-1.5 text-xs font-bold text-red-300"><span className="h-2 w-2 rounded-full bg-red-500" />{t('EMERGENCY HELP')}</span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('Need urgent help?')}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">{t('Send your location and an alert to the response network. If you can, choose what kind of help you need first.')}</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
              <button type="button" onClick={openSosConfirmation} aria-label={t('Send emergency SOS')} className="group flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-red-600 px-8 text-xl font-extrabold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 active:scale-[.99] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-red-300 sm:w-auto sm:min-w-60">
                <ShieldAlert className="h-7 w-7 transition-transform group-hover:scale-110" /> {t('SEND SOS')}
              </button>
              <span className="text-xs font-medium text-slate-400">{t('Quick alert · confirm before sending')}</span>
            </div>
            {submitMessage && <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm font-semibold text-emerald-200" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{submitMessage}</p>}
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-5 shadow-[0_12px_38px_rgba(0,0,0,.16)] sm:p-6" aria-labelledby="location-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="location-heading" className="text-base font-extrabold text-white">{t('Your location')}</h2>
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-200">{locationState === 'loading' ? t('Finding your location…') : location ? location.address : t('Location not available')}</p>
          {location && <><p className="mt-1 break-all text-xs text-slate-400">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p><p className="mt-1 text-xs text-slate-400">{location.source === 'gps' ? `${t('Accuracy')}: ±${location.accuracy} m` : t('Location entered manually')} · {t(location.source === 'gps' ? 'Captured' : 'Updated')}: {new Date(location.capturedAt).toLocaleTimeString()}</p></>}
          {locationError && <p className="mt-2 text-xs leading-5 text-amber-300" role="status">{locationError}</p>}
          <button type="button" onClick={locate} disabled={locationState === 'loading'} className="mt-4 min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50">{locationState === 'loading' ? t('Locating…') : t('Refresh location')}</button>
          <button type="button" onClick={() => onCreateReport(category, location)} className="ml-2 min-h-11 rounded-xl px-3 text-sm font-bold text-sky-300 hover:bg-slate-800">{t(location ? 'Correct location in report' : 'Add location manually')}</button>
        </aside>
      </section>

      {/* Category shortcuts open the detailed form with the current location. */}
      <section aria-labelledby="quick-categories-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{t('Quick report')}</p><h2 id="quick-categories-heading" className="mt-1 text-xl font-extrabold text-white">{t('What is happening?')}</h2></div>
          <span className="text-xs text-slate-400">{t('Choose a category to add details')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map(({ id, label, icon: Icon, tone }) => (
            <button key={id} type="button" onClick={() => { setCategory(id); onCreateReport(id, location); }} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
              <span className="mt-4 text-sm font-bold text-slate-100">{t(label)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Show the citizen's most recent report states and the full report list link. */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6" aria-labelledby="recent-reports-heading">
        <div className="flex items-center justify-between gap-3">
          <div><h2 id="recent-reports-heading" className="text-base font-extrabold text-white">{t('Recent reports')}</h2><p className="mt-1 text-sm text-slate-400">{t('Check the latest status of your requests.')}</p></div>
          <button type="button" onClick={onOpenReports} className="min-h-11 rounded-xl px-3 text-sm font-bold text-sky-300 hover:bg-slate-800">{t('View all')}</button>
        </div>
        {reports.length ? <ul className="mt-4 divide-y divide-slate-800">{reports.slice(0, 2).map((report) => <li key={report.id} className="flex items-center justify-between gap-3 py-3"><span><strong className="block text-sm text-slate-100">{t(report.category)}</strong><small className="text-xs text-slate-400">{report.id} · {t(report.status || 'REPORTED')}</small></span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200">{t(report.severity || 'Pending')}</span></li>)}</ul> : <p className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-300">{t('No emergency reports yet.')}</p>}
      </section>

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-400"><Radio className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />{t('If you are in immediate danger, use the SOS action. This project prototype does not replace local emergency services.')}</p>

      {/* Prevent accidental SOS activation and let the user cancel before sending. */}
      {showConfirm && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
        <section role="alertdialog" aria-modal="true" aria-labelledby="sos-confirm-title" aria-describedby="sos-confirm-description" className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/60 text-red-300"><ShieldAlert className="h-6 w-6" /></span><button type="button" onClick={() => setShowConfirm(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800" aria-label="Cancel SOS"><X className="h-5 w-5" /></button></div>
          <h2 id="sos-confirm-title" className="mt-5 text-2xl font-extrabold text-white">{t('Are you in an emergency?')}</h2>
          <p id="sos-confirm-description" className="mt-2 text-sm leading-6 text-slate-300">{t('We’ll send an SOS alert with your location and selected category:')} <strong>{t(category)}</strong>.</p>
          {location && <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs"><p className="font-bold text-white">{location.address}</p><p className="mt-1 text-slate-300">{location.lat.toFixed(5)}, {location.lng.toFixed(5)} · {location.source === 'gps' ? `±${location.accuracy} m` : t('manual location')}</p><p className="mt-1 text-slate-500">{t(location.source === 'gps' ? 'Location captured' : 'Location updated')}: {new Date(location.capturedAt).toLocaleTimeString()}</p></div>}
          {!location && <p className="mt-3 rounded-xl bg-amber-950/60 p-3 text-xs text-amber-200">{t('Your GPS location is not ready. Refresh it or add a location in the detailed report before sending.')}</p>}
          <a href="tel:112" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-950/60 px-4 text-sm font-extrabold text-red-100 hover:bg-red-900"><PhoneCall className="h-4 w-4" />Call official emergency number 112</a>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setShowConfirm(false)} className="min-h-12 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 hover:bg-slate-800">{t('Cancel')}</button>
            <button type="button" onClick={submitSos} disabled={seconds > 0 || !location || isSubmitting} className="min-h-12 rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300">{isSubmitting ? t('Sending…') : seconds > 0 ? `${t('Send SOS')} (${seconds})` : t('Send SOS')}</button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">{seconds > 0 ? `${t('Send option unlocks in')} ${seconds} ${t('seconds.')}` : t('Please send only for a real emergency.')}</p>
        </section>
      </div>}
    </div>
  );
}
