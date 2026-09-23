import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { DEMO_ACCOUNTS, VOLUNTEER_TYPES } from '../services/demoAuth';

const roles = [
  { value: 'CITIZEN', label: 'Citizen', description: 'View resource status' },
  { value: 'VOLUNTEER', label: 'Volunteer', description: 'Medical, rescue, or vehicle unit' },
  { value: 'AUTHORITY', label: 'Authority', description: 'Monitor emergency resources' },
];

export default function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CITIZEN');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must contain at least 6 characters.');
    const account = DEMO_ACCOUNTS.find((item) => item.role === role && item.email === email.trim().toLowerCase() && item.password === password);
    if (!account) return setError('Incorrect demo credentials for this role. Choose a demo account below or enter its shown ID and password.');
    onLogin({ email: account.email, role: account.role, name: account.name, volunteerType: account.volunteerType });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <form onSubmit={submit} className="login-modal relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-sky-500" />
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close login dialog"><X className="h-5 w-5" /></button>
        <div className="px-6 pb-6 pt-8 sm:px-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-950/70 text-red-300"><ShieldCheck className="h-6 w-6" /></div>
          <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-300">SECURE ACCESS PORTAL</p>
          <h2 id="login-title" className="mt-1 font-heading text-2xl font-extrabold text-white">Sign in to ResQNet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Volunteer sign-ins mark the account active and show its location on the live map.</p>

          <div className="my-6 grid grid-cols-3 gap-2" aria-label="Choose your account role">
            {roles.map((item) => (
              <button key={item.value} type="button" onClick={() => setRole(item.value)} className={`rounded-xl border px-2 py-3 text-left transition ${role === item.value ? 'border-red-500/70 bg-red-950/50 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'}`}>
                <span className="block text-xs font-bold">{item.label}</span>
                <span className="mt-1 block text-[10px] leading-4 opacity-80">{item.description}</span>
              </button>
            ))}
          </div>

          <label className="mb-4 block text-xs font-semibold text-slate-300">Email address
            <span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoFocus value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} type="email" placeholder="you@example.com" className="login-input pl-10" /></span>
          </label>
          <label className="block text-xs font-semibold text-slate-300">Password
            <span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} type={showPassword ? 'text' : 'password'} placeholder="Minimum 6 characters" className="login-input px-10" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
          </label>
          {error && <p className="mt-3 text-xs font-medium text-red-300" role="alert">{error}</p>}
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-slate-400">DEMO ACCOUNTS — CLICK TO FILL</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button key={account.email} type="button" onClick={() => { setRole(account.role); setEmail(account.email); setPassword(account.password); setError(''); }} className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition hover:border-red-500/50 hover:bg-slate-800">
                  <span><span className="block text-xs font-bold text-slate-200">{account.label}</span><span className="text-[10px] text-slate-500">{account.volunteerType ? VOLUNTEER_TYPES[account.volunteerType].shortLabel : account.email}</span><span className="block text-[10px] text-slate-600">{account.volunteerType ? account.email : ''}</span></span>
                  <code className="rounded bg-slate-800 px-1.5 py-1 text-[10px] text-red-200">{account.password}</code>
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-red-500"><UserRound className="h-4 w-4" /> Sign in as {roles.find((item) => item.value === role)?.label}</button>
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">Frontend demonstration only. Production authentication will use the secured API, password hashing, and JWT sessions.</p>
        </div>
      </form>
    </div>
  );
}
