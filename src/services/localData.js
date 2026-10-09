import { authHeaders } from './localAuth';

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Local API returned HTTP ${response.status}.`);
  return payload;
}

async function request(path, options = {}) {
  return readJson(await fetch(path, {
    ...options,
    headers: { accept: 'application/json', ...authHeaders(), ...(options.headers || {}) },
  }));
}

export async function fetchOperationalUnits(role) {
  if (!['VOLUNTEER', 'MANAGEMENT'].includes(role)) return null;
  const units = await request('/api/operational-units');
  return {
    volunteers: units.filter((unit) => unit.unitType === 'VOLUNTEER'),
    resources: units.filter((unit) => unit.unitType === 'RESOURCE'),
  };
}

export async function saveOperationalUnit(unit) {
  const savedUnit = { ...unit, unitType: unit.unitType || (unit.volunteerType ? 'VOLUNTEER' : 'RESOURCE') };
  return request('/api/operational-units', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(savedUnit),
  });
}

export async function createResourceUnit(resource) {
  const unit = { ...resource, id: resource.id || crypto.randomUUID(), unitType: 'RESOURCE' };
  return request('/api/operational-units', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(unit),
  });
}

export async function fetchAdminProfiles() {
  return request('/api/profiles');
}

export async function updateAdminProfileRole(profileId, role) {
  return request(`/api/profiles/${encodeURIComponent(profileId)}/role`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}

export async function deleteAdminProfile(profileId) {
  return request(`/api/profiles/${encodeURIComponent(profileId)}`, { method: 'DELETE' });
}

export async function reviewVolunteerRequest(profileId, decision) {
  return request(`/api/profiles/${encodeURIComponent(profileId)}/volunteer-request`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}

export function subscribeToOperationalUpdates(onUnit) {
  const refresh = () => fetchOperationalUnits('MANAGEMENT').then((snapshot) => {
    [...snapshot.volunteers, ...snapshot.resources].forEach(onUnit);
  }).catch(() => {});
  const interval = setInterval(refresh, 8000);
  return () => clearInterval(interval);
}
