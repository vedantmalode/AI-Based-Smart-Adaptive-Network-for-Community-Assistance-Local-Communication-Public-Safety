import { authHeaders } from './localAuth';
import { apiUrl } from './apiUrl';

const INCIDENTS_URL = apiUrl('/api/incidents');

function getNativeBridge() {
  return typeof window !== 'undefined' ? window.ResQNetNative : null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read evidence file.'));
    reader.readAsDataURL(blob);
  });
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Incident API returned HTTP ${response.status}.`);
  return payload;
}

export async function fetchServerIncidents() {
  const nativeBridge = getNativeBridge();
  let nativeIncidents = null;
  if (nativeBridge?.getIncidents) {
    nativeIncidents = JSON.parse(nativeBridge.getIncidents());
    if (!Array.isArray(nativeIncidents)) throw new Error('Android incident store returned an invalid response.');
  }
  const response = await fetch(INCIDENTS_URL, { headers: { ...authHeaders(), accept: 'application/json' } });
  const saved = await readJsonResponse(response);
  const byId = new Map(saved.map((incident) => [incident.clientUuid || incident.id, incident]));
  (nativeIncidents || []).forEach((incident) => byId.set(incident.clientUuid || incident.id, { ...incident, ...byId.get(incident.clientUuid || incident.id) }));
  return [...byId.values()];
}

export async function fetchMyServerIncidents() {
  const response = await fetch(apiUrl('/api/my-incidents'), { headers: { ...authHeaders(), accept: 'application/json' } });
  return readJsonResponse(response);
}

export async function syncIncidentToServer(incident) {
  const media = await Promise.all((incident.media || []).map(async (item) => {
    const { blob, url, ...metadata } = item;
    const dataUrl = blob instanceof Blob
      ? await blobToDataUrl(blob)
      : item.dataUrl || (url?.startsWith('https://') || url?.startsWith('http://') || url?.startsWith('data:') ? url : undefined);
    return { ...metadata, ...(dataUrl ? { dataUrl } : {}) };
  }));
  const payload = { ...incident, media };
  const nativeBridge = getNativeBridge();
  if (nativeBridge?.saveIncident) {
    const nativeSaved = JSON.parse(nativeBridge.saveIncident(JSON.stringify(payload)));
    if (nativeSaved.error) throw new Error(nativeSaved.error);
  }
  const response = await fetch(INCIDENTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
}

export async function updateIncidentOnServer(incidentId, changes, fallbackIncident) {
  const response = await fetch(`${INCIDENTS_URL}/${encodeURIComponent(incidentId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(changes),
  });
  if (response.status === 404 && fallbackIncident) return syncIncidentToServer({ ...fallbackIncident, ...changes });
  return readJsonResponse(response);
}

export async function acceptIncidentAssignment(incidentId, resourceId, volunteerId) {
  const incidents = await fetchServerIncidents();
  const incident = incidents.find((item) => item.id === incidentId);
  if (!incident) throw new Error('Incident was not found.');
  return updateIncidentOnServer(incidentId, {
    status: 'RESPONDING',
    assignedVolunteers: [...new Set([...(incident.assignedVolunteers || []), volunteerId].filter(Boolean))],
    assignedResources: resourceId ? [...new Set([...(incident.assignedResources || []), resourceId])] : incident.assignedResources || [],
  }, incident);
}

export function subscribeToIncidentUpdates(onIncident) {
  if (typeof window === 'undefined' || !authHeaders().authorization) return () => {};
  let stopped = false;
  let firstSnapshot = true;
  const knownUpdates = new Map();
  const refresh = async () => {
    if (stopped) return;
    try {
      const response = await fetch(apiUrl('/api/sync-incidents'), { headers: { ...authHeaders(), accept: 'application/json' } });
      if (response.status === 401 || response.status === 403) return;
      const incidents = await readJsonResponse(response);
      if (!Array.isArray(incidents)) return;
      incidents.forEach((incident) => {
        const key = incident.clientUuid || incident.id;
        const revision = incident.updatedAt || incident.reportedAt || '';
        if (!firstSnapshot && knownUpdates.get(key) !== revision) onIncident(incident);
        knownUpdates.set(key, revision);
      });
      firstSnapshot = false;
    } catch (error) {
      console.warn('Could not refresh incident updates:', error);
    }
  };
  refresh();
  const timer = window.setInterval(refresh, 10000);
  return () => { stopped = true; window.clearInterval(timer); };
}
