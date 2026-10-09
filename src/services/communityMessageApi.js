import { db } from './offlineStore';
import { authHeaders } from './localAuth';
import { apiUrl } from './apiUrl';

const MESSAGES_URL = apiUrl('/api/messages');

function fromRow(row) {
  return {
    id: row.id,
    senderId: row.sender_id || row.senderId || null,
    recipientId: row.recipient_id || row.recipientId || null,
    senderName: row.sender_name || row.senderName || 'Community member',
    originNodeId: row.origin_node_id || row.originNodeId || '',
    body: row.body,
    hopCount: row.hop_count ?? row.hopCount ?? 0,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    deliveryState: row.deliveryState || 'SHARED',
  };
}

function nativeMessages() {
  try {
    const result = window.ResQNetNative?.getCommunityMessages?.();
    return result ? JSON.parse(result).map((item) => ({ ...fromRow(item), deliveryState: 'RELAYED' })) : [];
  } catch (error) {
    console.warn('Could not restore Android community messages:', error);
    return [];
  }
}

export async function fetchCommunityMessages() {
  const [cached, native] = await Promise.all([
    db.communityMessages.toArray().catch(() => []),
    Promise.resolve(typeof window === 'undefined' ? [] : nativeMessages()),
  ]);
  const response = await fetch(MESSAGES_URL, { headers: { ...authHeaders(), accept: 'application/json' } });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error(payload.error || `Could not load messages (HTTP ${response.status}).`);
  const shared = (payload || []).map(fromRow);
  const deliveryRank = { RELAYED: 1, QUEUED: 2, SHARED: 3 };
  const byId = new Map();
  [...native, ...cached, ...shared].forEach((item) => {
    const previous = byId.get(item.id);
    const deliveryState = (deliveryRank[previous?.deliveryState] || 0) > (deliveryRank[item.deliveryState] || 0)
      ? previous.deliveryState
      : item.deliveryState;
    byId.set(item.id, { ...previous, ...item, deliveryState });
  });
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-200);
}

async function saveLocally(message) {
  await db.communityMessages.put(message);
  return message;
}

async function publishToLocalApi(message) {
  const response = await fetch(MESSAGES_URL, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(message),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Message API returned HTTP ${response.status}.`);
  return fromRow(data);
}

export async function sendCommunityMessage({ body, senderName, originNodeId, recipientId }) {
  const cleanBody = String(body || '').trim();
  if (!cleanBody || cleanBody.length > 500) throw new Error('Messages must contain 1 to 500 characters.');
  const message = {
    id: globalThis.crypto?.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderName: String(senderName || 'Community member').slice(0, 80),
    originNodeId: String(originNodeId || '').slice(0, 80),
    recipientId: recipientId || null,
    body: cleanBody,
    hopCount: 0,
    createdAt: new Date().toISOString(),
    deliveryState: 'QUEUED',
  };
  await saveLocally(message);
  if (!message.recipientId && typeof window !== 'undefined' && window.ResQNetNative?.sendCommunityMessage) {
    try {
      const result = JSON.parse(window.ResQNetNative.sendCommunityMessage(JSON.stringify(message)));
      if (result.error) console.warn('Message saved locally; Android relay rejected it:', result.error);
    } catch (error) { console.warn('Message saved locally; Android relay is unavailable:', error); }
  }
  const shared = await publishToLocalApi(message);
  const saved = { ...message, ...shared, deliveryState: 'SHARED' };
  await saveLocally(saved);
  return saved;
}

export async function receiveCommunityMessage(incoming) {
  if (!incoming?.id || !String(incoming.body || '').trim()) return null;
  const message = fromRow({ ...incoming, deliveryState: 'RELAYED' });
  await saveLocally(message);
  if (navigator.onLine && !message.recipientId) {
    try {
      const shared = await publishToLocalApi(message);
      const saved = { ...message, ...shared, deliveryState: 'SHARED' };
      await saveLocally(saved);
      return saved;
    } catch (error) { console.warn('Relayed message remains local:', error); }
  }
  return message;
}

export async function syncPendingCommunityMessages() {
  const pending = await db.communityMessages.where('deliveryState').anyOf(['QUEUED', 'RELAYED']).toArray();
  let synced = 0;
  for (const message of pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
    try {
      const saved = await publishToLocalApi(message);
      await saveLocally({ ...message, ...saved, deliveryState: 'SHARED' });
      synced++;
    } catch (error) { console.warn('Message remains queued:', message.id, error); }
  }
  return synced;
}

export function subscribeToCommunityMessages(onMessage) {
  let seen = new Set();
  const refresh = () => fetchCommunityMessages().then((messages) => {
    messages.forEach((message) => {
      if (!seen.has(message.id)) onMessage(message);
    });
    seen = new Set(messages.map((message) => message.id));
  }).catch(() => {});
  refresh();
  const interval = setInterval(refresh, 8000);
  return () => clearInterval(interval);
}
