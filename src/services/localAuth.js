import { apiUrl } from './apiUrl';

const TOKEN_KEY = 'resqnet-management-token';
let rememberSession = true;

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
  catch { return ''; }
}

export function authHeaders() {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Local API returned HTTP ${response.status}.`);
  return payload;
}

export function setRememberMe(value) {
  rememberSession = Boolean(value);
  try {
    const current = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (!current) return;
    (rememberSession ? localStorage : sessionStorage).setItem(TOKEN_KEY, current);
    (rememberSession ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
  } catch { /* Session can still continue in memory-backed browser state. */ }
}

export async function signInWithPassword(identifier, password) {
  const user = identifier.trim().toLowerCase();
  const payload = await readJson(await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ identifier: user, password }),
  }));
  try {
    (rememberSession ? localStorage : sessionStorage).setItem(TOKEN_KEY, payload.token);
    (rememberSession ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
  } catch { throw new Error('Could not save the local session in this browser.'); }
  return payload.user;
}

export async function createAccount({ name, email, password, role, volunteerType }) {
  const payload = await readJson(await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ name, email: email.trim().toLowerCase(), password, role, volunteerType }),
  }));
  try {
    (rememberSession ? localStorage : sessionStorage).setItem(TOKEN_KEY, payload.token);
    (rememberSession ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
  } catch { throw new Error('Account created, but this browser could not save the sign-in session. Please sign in.'); }
  return payload.user;
}

export async function restoreAuthSession() {
  const token = getToken();
  if (!token) return null;
  try {
    return await readJson(await fetch(apiUrl('/api/auth/session'), { headers: { ...authHeaders(), accept: 'application/json' } }));
  } catch {
    await signOut();
    return null;
  }
}

export async function signOut() {
  try { await fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers: authHeaders() }); } catch { /* Local token removal still ends this browser session. */ }
  try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* Ignore unavailable browser storage. */ }
}
