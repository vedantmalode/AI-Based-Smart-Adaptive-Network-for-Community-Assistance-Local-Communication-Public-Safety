import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'incidents.json');
const MESSAGES_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'community-messages.json');
const UNITS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'operational-units.json');
const PROFILES_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'profiles.json');
const ACCOUNTS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'accounts.json');
const AUTH_SECRET_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'local-auth-secret.txt');
const STORE_FILES = new Map([
  [DATA_FILE, 'incidents'],
  [MESSAGES_FILE, 'community_messages'],
  [UNITS_FILE, 'operational_units'],
  [PROFILES_FILE, 'profiles'],
  [ACCOUNTS_FILE, 'accounts'],
]);
let storeQueue = Promise.resolve();
let authSecretPromise;
const STATUS_TIMESTAMPS = {
  VERIFIED: 'verifiedAt',
  ASSIGNED: 'assignedAt',
  RESPONDING: ['assignedAt', 'respondingAt'],
  RESOLVED: 'resolvedAt',
};
const VALID_STATUSES = new Set(['REPORTED', 'PENDING_SYNC', 'VERIFIED', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'REJECTED']);

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(join(dirname(dirname(fileURLToPath(import.meta.url))), '.env.local'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadLocalEnvironment();
if (Boolean(process.env.SUPABASE_URL) !== Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error('Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use the hosted database.');
}
if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) {
  throw new Error('Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY so application data is persistent.');
}
if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SESSION_SECRET) {
  throw new Error('Production requires a stable AUTH_SESSION_SECRET of at least 32 characters.');
}
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGIN) {
  throw new Error('Production requires FRONTEND_ORIGIN so the API only accepts requests from the deployed frontend.');
}

async function getAuthSecret() {
  if (process.env.AUTH_SESSION_SECRET) return process.env.AUTH_SESSION_SECRET;
  if (!authSecretPromise) authSecretPromise = (async () => {
    try { return await readFile(AUTH_SECRET_FILE, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const secret = randomBytes(48).toString('base64url');
      await mkdir(dirname(AUTH_SECRET_FILE), { recursive: true });
      await writeFile(AUTH_SECRET_FILE, secret, { encoding: 'utf8', mode: 0o600 });
      return secret;
    }
  })();
  return authSecretPromise;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function signSession(user) {
  const secret = await getAuthSecret();
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function getSession(request) {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const secret = await getAuthSecret();
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (user.exp <= Date.now()) return null;
    if (user.role === 'MANAGEMENT') {
      return user.id?.toLowerCase() === (process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid').toLowerCase() ? user : null;
    }
    if (!['CITIZEN', 'VOLUNTEER'].includes(user.role)) return null;
    const accounts = await readJsonFile(ACCOUNTS_FILE);
    const account = accounts.find((item) => item.id === user.id || item.email === user.email || item.email === user.id);
    return account?.role === user.role ? { ...user, volunteerId: account.volunteerId, volunteerType: account.volunteerType } : null;
  } catch { return null; }
}

async function readJsonFile(path, fallback = []) {
  if (isDatabaseConfigured()) {
    const key = STORE_FILES.get(path);
    if (!key) throw new Error(`No persistent store key is configured for ${path}.`);
    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/resqnet_app_state?store_key=eq.${encodeURIComponent(key)}&select=data`, {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`Could not read ${key} from Supabase (${response.status}).`);
    const rows = await response.json();
    const value = rows[0]?.data;
    return Array.isArray(value) ? value : fallback;
  }
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(value) ? value : fallback;
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function isDatabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    accept: 'application/json',
  };
}

async function writeJsonFile(path, value) {
  if (isDatabaseConfigured()) {
    const key = STORE_FILES.get(path);
    if (!key) throw new Error(`No persistent store key is configured for ${path}.`);
    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/resqnet_app_state?on_conflict=store_key`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ store_key: key, data: value }),
    });
    if (!response.ok) throw new Error(`Could not write ${key} to Supabase (${response.status}).`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function normalizeLegacyAccountRoles() {
  const accounts = await readJsonFile(ACCOUNTS_FILE);
  let accountsChanged = false;
  for (const account of accounts) {
    if (!['CITIZEN', 'VOLUNTEER'].includes(account.role)) {
      account.role = 'CITIZEN';
      delete account.volunteerId;
      delete account.volunteerType;
      delete account.requestedRole;
      accountsChanged = true;
    }
  }
  if (accountsChanged) await writeJsonFile(ACCOUNTS_FILE, accounts);

  const profiles = await readJsonFile(PROFILES_FILE);
  let profilesChanged = false;
  for (const profile of profiles) {
    if (!['CITIZEN', 'VOLUNTEER', 'MANAGEMENT'].includes(profile.role)) {
      profile.role = 'CITIZEN';
      profile.requested_role = null;
      profile.request_status = null;
      delete profile.volunteer_id;
      profilesChanged = true;
    }
  }
  if (profilesChanged) await writeJsonFile(PROFILES_FILE, profiles);
}

await normalizeLegacyAccountRoles();

async function readIncidents() {
  return readJsonFile(DATA_FILE);
}

async function readCommunityMessages() {
  return readJsonFile(MESSAGES_FILE);
}

function updateIncidentStore(update) {
  const operation = storeQueue.then(async () => {
    const incidents = await readIncidents();
    const result = await update(incidents);
    if (isDatabaseConfigured()) await writeJsonFile(DATA_FILE, incidents);
    else {
      await mkdir(dirname(DATA_FILE), { recursive: true });
      const temporaryFile = `${DATA_FILE}.tmp`;
      await writeFile(temporaryFile, `${JSON.stringify(incidents, null, 2)}\n`, 'utf8');
      await rename(temporaryFile, DATA_FILE);
    }
    return result;
  });
  storeQueue = operation.catch(() => {});
  return operation;
}

function updateCommunityMessages(update) {
  const operation = storeQueue.then(async () => {
    const messages = await readCommunityMessages();
    const result = await update(messages);
    if (isDatabaseConfigured()) await writeJsonFile(MESSAGES_FILE, messages);
    else {
      await mkdir(dirname(MESSAGES_FILE), { recursive: true });
      const temporaryFile = `${MESSAGES_FILE}.tmp`;
      await writeFile(temporaryFile, `${JSON.stringify(messages, null, 2)}\n`, 'utf8');
      await rename(temporaryFile, MESSAGES_FILE);
    }
    return result;
  });
  storeQueue = operation.catch(() => {});
  return operation;
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 40 * 1024 * 1024) {
      const error = new Error('Request body exceeds the 40 MB limit.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (origin && (!allowedOrigins.length || allowedOrigins.includes(origin))) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('access-control-allow-headers', 'Authorization, Content-Type, Accept');
  response.setHeader('access-control-max-age', '86400');
}

const server = createServer(async (request, response) => {
  applyCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const submitted = await readRequestBody(request);
      const expectedId = process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid';
      const expectedPassword = process.env.MANAGEMENT_PASSWORD;
      const identifier = String(submitted?.identifier || '').trim().toLowerCase();
      const password = String(submitted?.password || '');
      if (expectedPassword && safeEqual(identifier, expectedId.toLowerCase()) && safeEqual(password, expectedPassword)) {
        const user = { id: expectedId, email: expectedId, name: 'Management room', role: 'MANAGEMENT' };
        sendJson(response, 200, { token: await signSession(user), user });
        return;
      }
      const account = (await readJsonFile(ACCOUNTS_FILE)).find((item) => item.email === identifier);
      const passwordHash = account && scryptSync(password, account.passwordSalt, 64).toString('hex');
      if (!account || !safeEqual(passwordHash, account.passwordHash)) {
        sendJson(response, 401, { error: 'Invalid email or Management ID and password.' });
        return;
      }
      const { passwordSalt, passwordHash: storedHash, ...user } = account;
      sendJson(response, 200, { token: await signSession(user), user });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
      const submitted = await readRequestBody(request);
      const name = typeof submitted?.name === 'string' ? submitted.name.trim() : '';
      const email = typeof submitted?.email === 'string' ? submitted.email.trim().toLowerCase() : '';
      const password = typeof submitted?.password === 'string' ? submitted.password : '';
      const role = submitted?.role;
      const volunteerType = submitted?.volunteerType;
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
      if (name.length < 2 || name.length > 80 || !validEmail || password.length < 8 || password.length > 200
        || !['CITIZEN', 'VOLUNTEER'].includes(role)
        || (role === 'VOLUNTEER' && !['MEDICAL_RESPONDER', 'RESCUE_SQUAD', 'OTHER'].includes(volunteerType))) {
        sendJson(response, 400, { error: 'Enter a valid name, email, password of at least 8 characters, and account type.' });
        return;
      }
      const accounts = await readJsonFile(ACCOUNTS_FILE);
      if (email === (process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid').toLowerCase()
        || accounts.some((item) => item.email === email)) {
        sendJson(response, 409, { error: 'An account with this email already exists.' });
        return;
      }
      const passwordSalt = randomBytes(16).toString('hex');
      const passwordHash = scryptSync(password, passwordSalt, 64).toString('hex');
      const requestedRole = role === 'VOLUNTEER' ? 'VOLUNTEER' : undefined;
      const accountRole = role === 'VOLUNTEER' ? 'CITIZEN' : role;
      const user = { id: email, email, name, role: accountRole, ...(requestedRole ? { requestedRole, volunteerType } : {}) };
      accounts.push({ ...user, passwordSalt, passwordHash });
      await writeJsonFile(ACCOUNTS_FILE, accounts);

      const profiles = await readJsonFile(PROFILES_FILE, [{ id: process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid', display_name: 'Management room', role: 'MANAGEMENT', requested_role: null }]);
      profiles.push({
        id: email,
        display_name: name,
        role: accountRole,
        requested_role: requestedRole || null,
        request_status: requestedRole ? 'PENDING' : null,
        ...(volunteerType ? { volunteer_type: volunteerType } : {}),
      });
      await writeJsonFile(PROFILES_FILE, profiles);

      sendJson(response, 201, { token: await signSession(user), user });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/session') {
      const user = await getSession(request);
      if (!user) { sendJson(response, 401, { error: 'Your local account session has expired.' }); return; }
      const { exp, ...safeUser } = user;
      sendJson(response, 200, safeUser);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/incidents') {
      const user = await getSession(request);
      if (!user || !['VOLUNTEER', 'MANAGEMENT'].includes(user.role)) { sendJson(response, 403, { error: 'Volunteer or Management room access is required to view shared incidents.' }); return; }
      const incidents = await readIncidents();
      sendJson(response, 200, incidents);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/my-incidents') {
      const user = await getSession(request);
      if (!user || user.role !== 'CITIZEN') { sendJson(response, 403, { error: 'Sign in with a user account to view your reports.' }); return; }
      const incidents = await readIncidents();
      sendJson(response, 200, incidents.filter((incident) => incident.reporterId === user.id));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/sync-incidents') {
      const user = await getSession(request);
      if (!user) { sendJson(response, 401, { error: 'Sign in to synchronize incident updates.' }); return; }
      const incidents = await readIncidents();
      if (user.role === 'CITIZEN') sendJson(response, 200, incidents.filter((incident) => incident.reporterId === user.id));
      else if (['VOLUNTEER', 'MANAGEMENT'].includes(user.role)) sendJson(response, 200, incidents);
      else sendJson(response, 403, { error: 'Your account cannot view incident updates.' });
      return;
    }
    if (url.pathname.startsWith('/api/operational-units') || url.pathname.startsWith('/api/profiles')) {
      const user = await getSession(request);
      if (!user) { sendJson(response, 401, { error: 'Sign in to access this information.' }); return; }
      if (request.method === 'GET' && url.pathname === '/api/operational-units') {
        if (!['VOLUNTEER', 'MANAGEMENT'].includes(user.role)) { sendJson(response, 403, { error: 'Volunteer or Management room access is required to view operational units.' }); return; }
        sendJson(response, 200, await readJsonFile(UNITS_FILE));
        return;
      }
      if (['POST', 'PUT'].includes(request.method) && url.pathname === '/api/operational-units') {
        const unit = await readRequestBody(request);
        if (!unit?.id || !['VOLUNTEER', 'RESOURCE'].includes(unit.unitType)) { sendJson(response, 400, { error: 'A valid operational unit is required.' }); return; }
        const canManageUnits = user.role === 'MANAGEMENT';
        const canUpdateSelf = user.role === 'VOLUNTEER' && unit.unitType === 'VOLUNTEER' && unit.id === user.volunteerId;
        if (!canManageUnits && !canUpdateSelf) { sendJson(response, 403, { error: 'You can only update your own volunteer profile.' }); return; }
        const units = await readJsonFile(UNITS_FILE);
        const index = units.findIndex((item) => item.id === unit.id);
        if (index >= 0) {
          const updated = { ...units[index], ...unit, updatedAt: new Date().toISOString() };
          if (canUpdateSelf) updated.verified = true;
          units[index] = updated;
        } else units.unshift({ ...unit, ...(canUpdateSelf ? { verified: true } : {}), updatedAt: new Date().toISOString() });
        await writeJsonFile(UNITS_FILE, units);
        sendJson(response, 200, units[index >= 0 ? index : 0]);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/profiles') {
        if (user.role !== 'MANAGEMENT') { sendJson(response, 403, { error: 'Management room access is required to view account profiles.' }); return; }
        const profiles = await readJsonFile(PROFILES_FILE, [{ id: process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid', display_name: 'Management room', role: 'MANAGEMENT', requested_role: null }]);
        const accounts = await readJsonFile(ACCOUNTS_FILE);
        sendJson(response, 200, profiles.map((profile) => {
          const account = accounts.find((item) => item.id === profile.id || item.email === profile.id);
          const volunteerType = profile.volunteer_type || account?.volunteerType;
          return volunteerType ? { ...profile, volunteer_type: volunteerType } : profile;
        }));
        return;
      }
      const volunteerRequestMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/volunteer-request$/);
      if (request.method === 'PATCH' && volunteerRequestMatch) {
        if (user.role !== 'MANAGEMENT') { sendJson(response, 403, { error: 'Management room access is required to review volunteer requests.' }); return; }
        const profileId = decodeURIComponent(volunteerRequestMatch[1]);
        const { decision } = await readRequestBody(request);
        if (!['APPROVE', 'REJECT'].includes(decision)) { sendJson(response, 400, { error: 'Choose approve or reject for this volunteer request.' }); return; }
        const profiles = await readJsonFile(PROFILES_FILE, []);
        const profile = profiles.find((item) => item.id === profileId);
        if (!profile) { sendJson(response, 404, { error: 'Profile not found.' }); return; }
        if (profile.requested_role !== 'VOLUNTEER' || profile.request_status !== 'PENDING') {
          sendJson(response, 409, { error: 'This volunteer request is no longer pending.' });
          return;
        }
        const accounts = await readJsonFile(ACCOUNTS_FILE);
        const account = accounts.find((item) => item.id === profileId);
        if (!account) { sendJson(response, 404, { error: 'The account for this request was not found.' }); return; }
        if (decision === 'APPROVE') {
          const volunteerType = ['MEDICAL_RESPONDER', 'RESCUE_SQUAD', 'OTHER'].includes(profile.volunteer_type) ? profile.volunteer_type : 'OTHER';
          const volunteerId = `VOL-${randomBytes(4).toString('hex').toUpperCase()}`;
          account.role = 'VOLUNTEER';
          account.volunteerId = volunteerId;
          account.volunteerType = volunteerType;
          delete account.requestedRole;
          profile.role = 'VOLUNTEER';
          profile.volunteer_id = volunteerId;
          profile.request_status = 'APPROVED';
          profile.requested_role = null;
          const units = await readJsonFile(UNITS_FILE);
          const skillsByType = {
            MEDICAL_RESPONDER: ['Medical', 'First Aid', 'CPR'],
            RESCUE_SQUAD: ['Search & Rescue', 'First Aid'],
            OTHER: ['Community Support'],
          };
          units.unshift({
            id: volunteerId, unitType: 'VOLUNTEER', name: profile.display_name, volunteerType,
            verified: true, status: 'OFFLINE', availability: 'Signed out', skills: skillsByType[volunteerType],
            maxRadiusKm: 15, rating: 0, missionsCount: 0, location: null,
          });
          await writeJsonFile(UNITS_FILE, units);
        } else {
          account.role = 'CITIZEN';
          delete account.requestedRole;
          delete account.volunteerType;
          profile.requested_role = null;
          profile.request_status = 'REJECTED';
        }
        await writeJsonFile(ACCOUNTS_FILE, accounts);
        await writeJsonFile(PROFILES_FILE, profiles);
        sendJson(response, 200, profile);
        return;
      }
      const deleteProfileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
      if (request.method === 'DELETE' && deleteProfileMatch) {
        if (user.role !== 'MANAGEMENT') { sendJson(response, 403, { error: 'Management room access is required to delete accounts.' }); return; }
        const profileId = decodeURIComponent(deleteProfileMatch[1]);
        const managementId = (process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid').toLowerCase();
        if (profileId.toLowerCase() === managementId) { sendJson(response, 403, { error: 'The Management room account cannot be deleted here.' }); return; }

        const profiles = await readJsonFile(PROFILES_FILE, []);
        const accounts = await readJsonFile(ACCOUNTS_FILE, []);
        const profile = profiles.find((item) => item.id === profileId);
        const account = accounts.find((item) => item.id === profileId || item.email === profileId);
        if (!profile && !account) { sendJson(response, 404, { error: 'Account not found.' }); return; }

        const volunteerId = account?.volunteerId || profile?.volunteer_id;
        await writeJsonFile(PROFILES_FILE, profiles.filter((item) => item.id !== profileId));
        await writeJsonFile(ACCOUNTS_FILE, accounts.filter((item) => item.id !== profileId && item.email !== profileId));
        if (volunteerId) {
          const units = await readJsonFile(UNITS_FILE);
          await writeJsonFile(UNITS_FILE, units.filter((item) => item.id !== volunteerId));
        }
        sendJson(response, 200, { deleted: true, id: profileId });
        return;
      }
      const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/role$/);
      if (request.method === 'PATCH' && profileMatch) {
        if (user.role !== 'MANAGEMENT') { sendJson(response, 403, { error: 'Management room access is required to change account roles.' }); return; }
        const profileId = decodeURIComponent(profileMatch[1]);
        if (profileId === (process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid')) { sendJson(response, 403, { error: 'The Management account role cannot be changed here.' }); return; }
        const { role } = await readRequestBody(request);
        if (!['CITIZEN', 'VOLUNTEER'].includes(role)) { sendJson(response, 400, { error: 'Choose Citizen or Volunteer.' }); return; }
        const profiles = await readJsonFile(PROFILES_FILE, [{ id: process.env.MANAGEMENT_LOGIN_ID || 'management@resqnet.invalid', display_name: 'Management room', role: 'MANAGEMENT', requested_role: null }]);
        const profile = profiles.find((item) => item.id === profileId);
        if (!profile) { sendJson(response, 404, { error: 'Profile not found.' }); return; }
        if (role === 'VOLUNTEER' && profile.role !== 'VOLUNTEER') {
          sendJson(response, 400, { error: 'Use the volunteer request review to approve volunteer access.' });
          return;
        }
        const accounts = await readJsonFile(ACCOUNTS_FILE);
        const account = accounts.find((item) => item.id === profileId);
        if (account) {
          account.role = role;
          delete account.requestedRole;
          if (role !== 'VOLUNTEER') {
            const volunteerId = account.volunteerId;
            delete account.volunteerId;
            delete account.volunteerType;
            if (volunteerId) {
              const units = await readJsonFile(UNITS_FILE);
              await writeJsonFile(UNITS_FILE, units.filter((item) => item.id !== volunteerId));
            }
          }
          await writeJsonFile(ACCOUNTS_FILE, accounts);
        }
        profile.role = role;
        profile.requested_role = null;
        profile.request_status = null;
        if (role !== 'VOLUNTEER') delete profile.volunteer_id;
        await writeJsonFile(PROFILES_FILE, profiles);
        sendJson(response, 200, profile);
        return;
      }
      sendJson(response, 404, { error: 'Route not found.' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/messages') {
      const user = await getSession(request);
      if (!user || !['MANAGEMENT', 'VOLUNTEER'].includes(user.role)) { sendJson(response, 403, { error: 'Community messages are available only to management and volunteers.' }); return; }
      const messages = await readCommunityMessages();
      const visible = messages.filter((message) => !message.recipientId || message.senderId === user.id || message.recipientId === user.id);
      sendJson(response, 200, visible.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-200));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/messages') {
      const submitted = await readRequestBody(request);
      const user = await getSession(request);
      if (!user || !['MANAGEMENT', 'VOLUNTEER'].includes(user.role)) { sendJson(response, 403, { error: 'Only management and volunteers can send community messages.' }); return; }
      const body = typeof submitted?.body === 'string' ? submitted.body.trim() : '';
      if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)
        || typeof submitted.id !== 'string' || !submitted.id || submitted.id.length > 100
        || !body || body.length > 500) {
        sendJson(response, 400, { error: 'Message id and text from 1 to 500 characters are required.' });
        return;
      }
      const savedMessage = await updateCommunityMessages((messages) => {
        const existing = messages.find((item) => item.id === submitted.id);
        if (existing) return existing;
        const message = {
          id: submitted.id,
          senderId: user?.id || null,
          recipientId: submitted.recipientId || null,
          senderName: String(user?.name || submitted.senderName || 'Community member').slice(0, 80),
          originNodeId: String(user?.id || submitted.originNodeId || '').slice(0, 80),
          body,
          hopCount: Math.max(0, Math.min(10, Number(submitted.hopCount) || 0)),
          createdAt: submitted.createdAt || new Date().toISOString(),
        };
        messages.push(message);
        if (messages.length > 1000) messages.splice(0, messages.length - 1000);
        return message;
      });
      sendJson(response, 200, savedMessage);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/incidents') {
      const submitted = await readRequestBody(request);
      if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)
        || !submitted.id || !submitted.clientUuid || !submitted.category
        || !submitted.description
        || !Number.isFinite(submitted.location?.lat) || !Number.isFinite(submitted.location?.lng)
        || submitted.location.lat < -90 || submitted.location.lat > 90
        || submitted.location.lng < -180 || submitted.location.lng > 180) {
        sendJson(response, 400, { error: 'Incident id, client UUID, category, description, and coordinates are required.' });
        return;
      }

      const saved = await updateIncidentStore((incidents) => {
        const existingIndex = incidents.findIndex((item) => item.clientUuid === submitted.clientUuid || item.id === submitted.id);
        const now = new Date().toISOString();
        const existing = existingIndex >= 0 ? incidents[existingIndex] : null;
        const reportedAt = submitted.reportedAt || existing?.reportedAt || now;
        const incident = {
          ...existing,
          ...submitted,
          status: existing?.status || 'REPORTED',
          assignedVolunteers: existing?.assignedVolunteers || [],
          assignedResources: existing?.assignedResources || [],
          reportedAt,
          lifecycle: { ...existing?.lifecycle, ...submitted.lifecycle, reportedAt },
          serverReceivedAt: existing?.serverReceivedAt || now,
          updatedAt: now,
        };
        if (existingIndex >= 0) incidents[existingIndex] = { ...incidents[existingIndex], ...incident };
        else incidents.unshift(incident);
        return existingIndex >= 0 ? 200 : 201;
      });
      const incidents = await readIncidents();
      const savedIncident = incidents.find((item) => item.clientUuid === submitted.clientUuid || item.id === submitted.id);
      sendJson(response, saved, savedIncident);
      return;
    }
    const incidentMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)$/);
    if (request.method === 'PATCH' && incidentMatch) {
      const user = await getSession(request);
      if (!user || !['VOLUNTEER', 'MANAGEMENT'].includes(user.role)) { sendJson(response, 403, { error: 'Volunteer or Management room access is required to update incidents.' }); return; }
      const incidentId = decodeURIComponent(incidentMatch[1]);
      const changes = await readRequestBody(request);
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        sendJson(response, 400, { error: 'Incident updates must be a JSON object.' });
        return;
      }
      if (changes.status && !VALID_STATUSES.has(changes.status)) {
        sendJson(response, 400, { error: 'Incident status is not recognized.' });
        return;
      }
      if (changes.priorityBand !== undefined && !['P0', 'P1', 'P2', 'P3'].includes(changes.priorityBand)) {
        sendJson(response, 400, { error: 'Triage priority must be P0, P1, P2, or P3.' });
        return;
      }
      if (changes.priorityScore !== undefined && (!Number.isFinite(changes.priorityScore) || changes.priorityScore < 1 || changes.priorityScore > 99)) {
        sendJson(response, 400, { error: 'Triage score must be between 1 and 99.' });
        return;
      }
      if (changes.confidence !== undefined && (!Number.isFinite(changes.confidence) || changes.confidence < 0 || changes.confidence > 1)) {
        sendJson(response, 400, { error: 'Triage confidence must be between 0 and 1.' });
        return;
      }
      if (changes.severity !== undefined && !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(changes.severity)) {
        sendJson(response, 400, { error: 'Incident severity is not recognized.' });
        return;
      }
      for (const field of ['assignedVolunteers', 'assignedResources', 'auditTimeline', 'responseTasks', 'recommendedResources', 'priorityReasons', 'missingInformation', 'reviewFlags', 'potentialDuplicates']) {
        if (changes[field] !== undefined && !Array.isArray(changes[field])) {
          sendJson(response, 400, { error: `${field} must be an array.` });
          return;
        }
      }

        const now = new Date().toISOString();
        let updatedIncident;
        let assignmentError = null;
        const found = await updateIncidentStore(async (incidents) => {
        const index = incidents.findIndex((item) => item.id === incidentId || item.clientUuid === incidentId);
        if (index < 0) return false;
        const existing = incidents[index];
        if (user.role === 'VOLUNTEER') {
          const allowedFields = new Set(['status', 'assignedVolunteers', 'assignedResources', 'lifecycle', 'auditTimeline']);
          if (Object.keys(changes).some((field) => !allowedFields.has(field))
            || changes.status !== 'RESPONDING'
            || !Array.isArray(changes.assignedVolunteers)
            || !changes.assignedVolunteers.includes(user.volunteerId)
            || !(existing.assignedVolunteers || []).includes(user.volunteerId)) {
            assignmentError = 'Only a dispatcher-assigned volunteer may update their incident response status.';
            return false;
          }
        }
        if (user.role === 'MANAGEMENT' && Array.isArray(changes.assignedVolunteers)) {
          const units = await readJsonFile(UNITS_FILE);
          const currentAssignments = new Set(existing.assignedVolunteers || []);
          const newAssignments = changes.assignedVolunteers.filter((id) => !currentAssignments.has(id));
          const unavailableAssignment = newAssignments.find((id) => {
            const responder = units.find((unit) => unit.id === id && unit.unitType === 'VOLUNTEER');
            return !responder || responder.verified !== true || responder.status !== 'ACTIVE'
              || (responder.availability && !['available', 'available now', 'available for dispatch', 'on call', 'ready'].includes(String(responder.availability).trim().toLowerCase()));
          });
          if (unavailableAssignment) {
            assignmentError = 'New volunteer assignments require a verified, currently available responder.';
            return false;
          }
        }
        if (user.role === 'MANAGEMENT' && Array.isArray(changes.assignedResources)) {
          const units = await readJsonFile(UNITS_FILE);
          const currentAssignments = new Set(existing.assignedResources || []);
          const newAssignments = changes.assignedResources.filter((id) => !currentAssignments.has(id));
          const unavailableAssignment = newAssignments.find((id) => {
            const resource = units.find((unit) => unit.id === id && unit.unitType === 'RESOURCE');
            return !resource || resource.status !== 'AVAILABLE';
          });
          if (unavailableAssignment) {
            assignmentError = 'New resource assignments require an available resource.';
            return false;
          }
        }
        const nextStatus = changes.status || existing.status;
        const lifecycle = { ...existing.lifecycle, ...(changes.lifecycle || {}) };
        const lifecycleFields = STATUS_TIMESTAMPS[nextStatus];
        if (changes.status && changes.status !== existing.status && lifecycleFields) {
          for (const field of (Array.isArray(lifecycleFields) ? lifecycleFields : [lifecycleFields])) {
            if (!lifecycle[field]) lifecycle[field] = now;
          }
        }
        updatedIncident = {
          ...existing,
          ...(user.role === 'MANAGEMENT' ? Object.fromEntries([
            'category', 'severity', 'priorityBand', 'priorityScore', 'confidence', 'recommendedResources',
            'priorityReasons', 'missingInformation', 'reviewFlags', 'potentialDuplicates',
            'confidenceNote', 'explanation', 'priorityReason', 'aiRecommendation', 'triageOverride',
          ].filter((field) => changes[field] !== undefined).map((field) => [field, changes[field]])) : {}),
          ...(changes.status ? { status: changes.status } : {}),
          ...(changes.assignedVolunteers ? { assignedVolunteers: changes.assignedVolunteers } : {}),
          ...(changes.assignedResources ? { assignedResources: changes.assignedResources } : {}),
          ...(changes.auditTimeline ? { auditTimeline: changes.auditTimeline } : {}),
          ...(changes.responseTasks ? { responseTasks: changes.responseTasks } : {}),
          lifecycle: { ...lifecycle, reportedAt: lifecycle.reportedAt || existing.reportedAt },
          updatedAt: now,
        };
        incidents[index] = updatedIncident;
        return true;
      });
      if (!found) {
        sendJson(response, assignmentError ? 409 : 404, { error: assignmentError || 'Incident was not found.' });
        return;
      }
      sendJson(response, 200, updatedIncident);
      return;
    }
    sendJson(response, 404, { error: 'Route not found.' });
  } catch (error) {
    console.error('API request failed:', error);
    sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'Internal server error.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ResQNet incident API listening on ${HOST}:${PORT}`);
  console.log(isDatabaseConfigured() ? 'Application data is stored in Supabase Postgres.' : `Incident data is stored in ${DATA_FILE}`);
});
