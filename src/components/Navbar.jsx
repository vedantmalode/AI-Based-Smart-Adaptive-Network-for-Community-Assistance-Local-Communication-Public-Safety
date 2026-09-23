import React from 'react';
import { 
  ShieldAlert, 
  Map, 
  Wifi, 
  WifiOff, 
  Activity,
  LogIn,
  LogOut,
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  isOnline, 
  setIsOnline, 
  userSession,
  onOpenLogin,
  onLogout,
}) {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-4 lg:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Identity */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-500/30">
                <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight text-white">ResQ<span className="text-red-500">Net</span></span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-red-950/80 text-red-400 border border-red-800/60 rounded-full">v1.0 AI-PWA</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Public Safety & Disaster Management System</p>
            </div>
          </div>

          {/* Mobile Network Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {userSession ? (
              <button onClick={onLogout} className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900 text-[10px] font-semibold text-slate-200" title="Sign out">{userSession.role === 'VOLUNTEER' ? 'Volunteer active · Sign out' : 'Sign out'}</button>
            ) : (
              <button onClick={onOpenLogin} className="px-2.5 py-1 rounded-full border border-red-500/50 bg-red-600 text-[10px] font-bold text-white">Login</button>
            )}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 transition-all border ${
                isOnline 
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' 
                  : 'bg-red-950/90 text-red-300 border-red-800/80 pulse-critical'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </button>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'home'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('gis')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'gis'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Map className="w-4 h-4 text-blue-400" />
            <span>GIS Map</span>
          </button>

        </nav>

        {/* Network Status */}
        <div className="hidden md:flex items-center gap-3">
          {userSession ? (
            <button onClick={onLogout} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center gap-1.5 transition-all" title="Sign out">
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>{userSession.name}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">{userSession.role}</span>
            </button>
          ) : (
            <button onClick={onOpenLogin} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/50 bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-all shadow-sm shadow-red-950/40">
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
          <button
            onClick={() => setIsOnline(!isOnline)}
            title="Click to toggle Network Connection (Online / Offline Store & Forward)"
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold flex items-center gap-2 transition-all border ${
              isOnline 
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/80' 
                : 'bg-red-950/90 text-red-300 border-red-800/80 pulse-critical hover:bg-red-900/90'
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            <span>{isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
