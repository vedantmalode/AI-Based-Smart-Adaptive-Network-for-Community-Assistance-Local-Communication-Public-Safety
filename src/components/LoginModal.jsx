import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { createAccount, setRememberMe, signInWithPassword } from '../services/localAuth';

const VOLUNTEER_OPTIONS = [
  ['MEDICAL_RESPONDER', 'Doctor / Medical responder'],
  ['RESCUE_SQUAD', 'Rescue team'],
  ['OTHER', 'Other'],
];

export default function LoginModal({ onClose, onLogin }) {
  const [mode, setMode] = useState('signin');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('CITIZEN');
  const [volunteerType, setVolunteerType] = useState('MEDICAL_RESPONDER');
  const [rememberMe, setRememberMeValue] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isCreatingAccount = mode === 'create';

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (isCreatingAccount) {
      if (!name.trim()) return setError('Enter your name.');
      if (!email.trim()) return setError('Enter your email address.');
      if (password.length < 8) return setError('Choose a password with at least 8 characters.');
      if (password !== confirmPassword) return setError('The passwords do not match.');
    } else {
      if (!identifier.trim()) return setError('Enter your email or Management ID.');
      if (!password) return setError('Enter the password.');
    }
    setIsSubmitting(true);
    setRememberMe(rememberMe);
    try {
      const session = isCreatingAccount
        ? await createAccount({ name: name.trim(), email, password, role, ...(role === 'VOLUNTEER' ? { volunteerType } : {}) })
        : await signInWithPassword(identifier, password);
      onLogin(session);
    } catch (authError) {
      setError(authError.message || (isCreatingAccount ? 'Account creation failed.' : 'Sign-in failed. Check your email or Management ID and password.'));
    } finally { setIsSubmitting(false); }
  };

  const changeMode = (nextMode) => { setMode(nextMode); setError(''); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <form onSubmit={submit} className="login-modal relative max-h-[92vh] w-full max-w-md overflow-y-auto overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-sky-500" />
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close sign-in dialog"><X className="h-5 w-5" /></button>
        <div className="px-6 pb-6 pt-8 sm:px-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-950/70 text-red-300"><ShieldCheck className="h-6 w-6" /></div>
          <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-300">{isCreatingAccount ? 'JOIN THE RESPONSE NETWORK' : 'LOCAL PORTAL ACCESS'}</p>
          <h2 id="login-title" className="mt-1 font-heading text-2xl font-extrabold text-white">{isCreatingAccount ? 'Create your account' : 'Sign in to AI-Based'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{isCreatingAccount ? 'Create a user account to report emergencies, or join as a volunteer responder.' : 'Sign in with your account email, or use the Management ID configured for this portal.'}</p>

          {isCreatingAccount ? <>
            <label className="mb-3 mt-4 block text-xs font-semibold text-slate-300">Full name
              <span className="relative mt-2 block"><UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoFocus autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} type="text" maxLength={80} className="login-input pl-10" placeholder="Your name" /></span>
            </label>
            <label className="mb-3 block text-xs font-semibold text-slate-300">Email address
              <span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} type="email" maxLength={254} className="login-input pl-10" placeholder="you@example.com" /></span>
            </label>
            <label className="mb-3 block text-xs font-semibold text-slate-300">Account type
              <select value={role} onChange={(event) => { setRole(event.target.value); setError(''); }} className="login-input mt-2">
                <option value="CITIZEN">User — report emergencies and view your reports</option>
                <option value="VOLUNTEER">Volunteer — responder tools and incident map</option>
              </select>
            </label>
            {role === 'VOLUNTEER' && <label className="mb-3 block text-xs font-semibold text-slate-300">Volunteer type
              <select value={volunteerType} onChange={(event) => setVolunteerType(event.target.value)} className="login-input mt-2">
                {VOLUNTEER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>}
            <label className="mb-3 block text-xs font-semibold text-slate-300">Password
              <span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} type={showPassword ? 'text' : 'password'} minLength={8} className="login-input px-10" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Confirm password
              <span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} type="password" className="login-input pl-10" placeholder="Re-enter password" /></span>
            </label>
          </> : <>
            <label className="mb-4 mt-5 block text-xs font-semibold text-slate-300">Email or Management ID
              <span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoFocus autoComplete="username" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setError(''); }} type="text" className="login-input pl-10" placeholder="you@example.com" /></span>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Password
              <span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} type={showPassword ? 'text' : 'password'} className="login-input px-10" placeholder="Password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
          </>}
          <label className="mt-4 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMeValue(event.target.checked)} className="h-4 w-4 accent-red-600" /> Keep me signed in</label>
          {error && <p className="mt-3 text-xs font-medium text-red-300" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><UserRound className="h-4 w-4" />{isSubmitting ? (isCreatingAccount ? 'Creating account…' : 'Signing in…') : (isCreatingAccount ? 'Create account' : 'Sign in')}</button>
          <p className="mt-4 text-center text-xs text-slate-400">{isCreatingAccount ? 'Already have an account?' : 'New to the network?'} <button type="button" onClick={() => changeMode(isCreatingAccount ? 'signin' : 'create')} className="font-bold text-sky-300 hover:text-sky-200">{isCreatingAccount ? 'Sign in' : 'Create account'}</button></p>
          {!isCreatingAccount && <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Passwords are stored securely by this local portal. Management access is provisioned separately.</p>}
        </div>
      </form>
    </div>
  );
}
