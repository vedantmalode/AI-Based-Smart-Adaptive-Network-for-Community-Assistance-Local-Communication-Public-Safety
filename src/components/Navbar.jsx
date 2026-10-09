import React from 'react';
import { 
  ShieldAlert, 
  Map, 
  Wifi, 
  WifiOff, 
  Activity,
  LogIn,
  LogOut,
  BrainCircuit,
  Radio,
  Boxes,
  Bell,
  Settings,
  CircleHelp,
  Sun,
  Moon,
  MessageCircle,
  CheckCircle2,
  HeartPulse,
} from 'lucide-react';
import { hasAccess } from '../services/roleConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const NAV_ITEMS = [
  { id: 'home', label: 'Overview', icon: Activity, iconClass: 'text-emerald-400' },
  { id: 'admin', label: 'Admin', icon: Settings, iconClass: 'text-violet-400' },
  { id: 'sos', label: 'Report Emergency', icon: ShieldAlert, iconClass: 'text-red-400' },
  { id: 'firstAid', label: 'First Aid Assistant', icon: HeartPulse, iconClass: 'text-rose-400' },
  { id: 'gis', label: 'GIS Map', icon: Map, iconClass: 'text-blue-400' },
  { id: 'command', label: 'Incident Triage', icon: Activity, iconClass: 'text-amber-400' },
  { id: 'completed', label: 'Completed Incidents', icon: CheckCircle2, iconClass: 'text-emerald-400' },
  { id: 'volunteer', label: 'Volunteer Desk', icon: ShieldAlert, iconClass: 'text-cyan-400' },
  { id: 'resources', label: 'Resources', icon: Boxes, iconClass: 'text-emerald-400' },
  { id: 'notifications', label: 'Notifications', icon: Bell, iconClass: 'text-sky-400' },
  { id: 'messages', label: 'Community Messages', icon: MessageCircle, iconClass: 'text-cyan-400' },
  { id: 'ai', label: 'AI Metrics', icon: BrainCircuit, iconClass: 'text-purple-400' },
  { id: 'ble', label: 'Local Connect', icon: Radio, iconClass: 'text-emerald-400' },
];

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  isOnline, 
  userSession,
  onOpenLogin,
  onLogout,
  onShowOnboarding,
}) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme');
  const themeToggle = (compact = false) => <button
    type="button"
    onClick={toggleTheme}
    aria-label={nextThemeLabel}
    title={nextThemeLabel}
    className={compact
      ? 'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800'
      : 'inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800'}
  >
    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    {!compact && t(theme === 'dark' ? 'Light mode' : 'Dark mode')}
  </button>;
  const languageSelector = (mobile = false) => <label className={mobile ? 'sr-only' : 'text-[10px] font-semibold text-slate-400'}>
    {t('Language')}
    <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language" className={mobile ? 'sr-only' : 'ml-2 min-h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200'}>
      <option value="en">{t('English')}</option><option value="hi">{t('हिन्दी')}</option><option value="mr">{t('मराठी')}</option>
      <option value="bn">বাংলা</option><option value="gu">ગુજરાતી</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option>
    </select>
  </label>;
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-4 lg:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Identity */}
        <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab(userSession?.role === 'MANAGEMENT' ? 'admin' : 'home')}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-500/30">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight text-white">AI-Based</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-red-950/80 text-red-400 border border-red-800/60 rounded-full">v1.0 AI-PWA</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">– Smart Adaptive Network for Community Assistance, Local Communication & Public Safety</p>
            </div>
          </div>

          {/* Mobile Network Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {themeToggle(true)}
            <button type="button" onClick={onShowOnboarding} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300" aria-label={t('How this network works')} title={t('How this network works')}><CircleHelp className="h-4 w-4" /></button>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language" className="min-h-9 max-w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10px] text-slate-200"><option value="en">EN</option><option value="hi">हिंदी</option><option value="mr">मराठी</option><option value="bn">বাংলা</option><option value="gu">ગુજરાતી</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option></select>
            {userSession ? (
            <button onClick={onLogout} className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900 text-[10px] font-semibold text-slate-200" title={t('Sign out')}>{userSession.role === 'VOLUNTEER' ? `${t('Volunteer active')} · ${t('Sign out')}` : t('Sign out')}</button>
            ) : (
              <button onClick={onOpenLogin} className="px-2.5 py-1 rounded-full border border-red-500/50 bg-red-600 text-[10px] font-bold text-white">{t('Login')}</button>
            )}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 border ${
                isOnline 
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' 
                  : 'bg-red-950/90 text-red-300 border-red-800/80'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          {NAV_ITEMS.filter(({ id }) => hasAccess(userSession?.role, id)).map(({ id, label, icon: Icon, iconClass }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === id
                  ? id === 'sos' ? 'bg-red-600 text-white shadow-md shadow-red-600/30' : 'bg-slate-700 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${iconClass}`} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>

        {/* Network Status */}
        <div className="hidden md:flex items-center gap-3">
          {themeToggle()}
          <button type="button" onClick={onShowOnboarding} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800" aria-label={t('How this network works')}><CircleHelp className="h-4 w-4" />{t('Guide')}</button>
          {languageSelector()}
          {userSession ? (
            <button onClick={onLogout} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center gap-1.5 transition-all" title="Sign out">
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>{userSession.name}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">{userSession.role}</span>
            </button>
          ) : (
            <button onClick={onOpenLogin} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/50 bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-all shadow-sm shadow-red-950/40">
              <LogIn className="w-4 h-4" />
              <span>{t('Login')}</span>
            </button>
          )}
          <span
            title="Browser network connectivity status"
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold flex items-center gap-2 border ${
              isOnline 
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/80' 
                : 'bg-red-950/90 text-red-300 border-red-800/80 hover:bg-red-900/90'
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            <span>{isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
