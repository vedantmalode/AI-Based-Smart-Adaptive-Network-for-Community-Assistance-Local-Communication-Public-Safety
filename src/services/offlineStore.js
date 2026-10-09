// ResQNet IndexedDB Store-and-Forward Sync Engine (Dexie.js)
import Dexie from 'dexie';
import { acceptIncidentAssignment, syncIncidentToServer } from './incidentApi';

export const db = new Dexie('ResQNet_OfflineDB');

db.version(1).stores({
  outboundQueue: '++id, clientUuid, category, status, createdAt, retryCount',
  cachedIncidents: 'id, clientUuid, status, priorityScore, category, reportedAt',
  bleMeshBuffer: '++id, payloadHash, receivedAt, hopCount, forwarded'
});

db.version(2).stores({
  outboundQueue: '++id, clientUuid, category, status, createdAt, retryCount',
  cachedIncidents: 'id, clientUuid, status, priorityScore, category, reportedAt',
  bleMeshBuffer: '++id, payloadHash, receivedAt, hopCount, forwarded',
  outboundUpdates: '++id, &clientUuid, status, createdAt, retryCount',
});

db.version(3).stores({
  outboundQueue: '++id, clientUuid, category, status, createdAt, retryCount',
  cachedIncidents: 'id, clientUuid, status, priorityScore, category, reportedAt',
  bleMeshBuffer: '++id, payloadHash, receivedAt, hopCount, forwarded',
  outboundUpdates: '++id, &clientUuid, status, createdAt, retryCount',
  communityMessages: 'id, createdAt, deliveryState, originNodeId',
});

export const SYNC_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  SYNCING: "SYNCING",
  SYNCED: "SYNCED"
};

export async function saveIncidentToCache(incident) {
  await db.cachedIncidents.put({
    ...incident,
    cachedAt: new Date().toISOString(),
  });
  return incident;
}

export async function getCachedIncidents(reporterId) {
  const incidents = await db.cachedIncidents.toArray();
  return reporterId ? incidents.filter((incident) => incident.reporterId === reporterId) : incidents;
}

/**
 * Save emergency report to IndexedDB outbound queue (Store & Forward)
 */
export async function saveOfflineReport(incidentData) {
  const record = {
    incidentId: incidentData.id,
    clientUuid: incidentData.clientUuid || `client-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    category: incidentData.category,
    title: incidentData.title,
    description: incidentData.description,
    peopleAffected: incidentData.peopleAffected ?? 1,
    injuries: incidentData.injuries ?? false,
    trapped: incidentData.trapped ?? false,
    firePresent: incidentData.firePresent ?? false,
    location: incidentData.location,
    severity: incidentData.severity,
    priorityScore: incidentData.priorityScore,
    confidence: incidentData.confidence,
    reportedAt: incidentData.reportedAt,
    media: incidentData.media || [],
    createdAt: incidentData.reportedAt || new Date().toISOString(),
    status: "PENDING_SYNC",
    retryCount: 0
  };

  const queueId = await db.outboundQueue.add(record);
  
  // Also cache locally for instant offline UI update
  await saveIncidentToCache({
    ...incidentData,
    clientUuid: record.clientUuid,
    id: incidentData.id || record.clientUuid,
    status: "PENDING_SYNC",
  });

  return { queueId, record };
}

/**
 * Get all pending items in offline queue
 */
export async function getPendingOfflineQueue() {
  const reports = await db.outboundQueue.where('status').equals('PENDING_SYNC').toArray();
  return reports.sort((a, b) => (Number(b.priorityScore) || 0) - (Number(a.priorityScore) || 0)
    || new Date(a.createdAt) - new Date(b.createdAt));
}

export async function getPendingIncidentUpdates() {
  const updates = await db.outboundUpdates.where('status').equals('PENDING_SYNC').toArray();
  return updates.sort((a, b) => (Number(b.incident?.priorityScore) || 0) - (Number(a.incident?.priorityScore) || 0)
    || new Date(a.createdAt) - new Date(b.createdAt)).map((item) => ({
    ...item,
    category: item.incident.category,
    title: item.incident.title,
    description: item.incident.description,
    incidentId: item.incident.id,
  }));
}

export async function queueIncidentUpdate(incident) {
  if (!incident?.id || !incident?.clientUuid) return;
  await db.outboundUpdates.put({
    clientUuid: incident.clientUuid,
    incident,
    status: 'PENDING_SYNC',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function queueIncidentAcceptance(incident, resourceId, volunteerId) {
  if (!incident?.id || !incident?.clientUuid) return;
  await db.outboundUpdates.put({
    clientUuid: incident.clientUuid,
    incident,
    operation: 'ACCEPT_ASSIGNMENT',
    resourceId: resourceId || null,
    volunteerId: volunteerId || null,
    status: 'PENDING_SYNC',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

/**
 * Send queued reports to the incident API and retain any reports that fail to sync
 */
export async function processOfflineQueue(onReportSynced) {
  const pendingItems = await getPendingOfflineQueue();
  let syncedCount = 0;
  for (const item of pendingItems) {
    try {
      // Update queue status
      await db.outboundQueue.update(item.id, { status: "SYNCING" });
      
      const cachedIncident = await db.cachedIncidents.where('clientUuid').equals(item.clientUuid).first();
      const incident = cachedIncident || {
        ...item,
        id: item.incidentId || `INC-${item.clientUuid}`,
        isLocalReport: true,
        reportedAt: item.reportedAt || item.createdAt,
        assignedVolunteers: [],
        assignedResources: [],
        auditTimeline: [],
        media: item.media || [],
      };
      const savedIncident = await syncIncidentToServer(incident);

      if (onReportSynced) await onReportSynced(savedIncident);

      // Mark as synced and purge from queue
      await db.outboundQueue.update(item.id, { status: "SYNCED" });
      await db.outboundQueue.delete(item.id);
      syncedCount++;
    } catch (err) {
      console.error("Failed to sync item:", item.clientUuid, err);
      await db.outboundQueue.update(item.id, { 
        status: "PENDING_SYNC", 
        retryCount: (item.retryCount || 0) + 1 
      });
    }
  }

  const pendingUpdates = await db.outboundUpdates.where('status').equals('PENDING_SYNC').toArray();
  for (const item of pendingUpdates) {
    try {
      await db.outboundUpdates.update(item.id, { status: 'SYNCING' });
      const savedIncident = item.operation === 'ACCEPT_ASSIGNMENT'
        ? await acceptIncidentAssignment(item.incident.id, item.resourceId, item.volunteerId)
        : await syncIncidentToServer(item.incident);
      if (onReportSynced) await onReportSynced(savedIncident);
      await db.outboundUpdates.delete(item.id);
      syncedCount++;
    } catch (err) {
      console.error('Failed to sync incident update:', item.clientUuid, err);
      await db.outboundUpdates.update(item.id, {
        status: 'PENDING_SYNC',
        retryCount: (item.retryCount || 0) + 1,
      });
    }
  }

  return { syncedCount };
}
