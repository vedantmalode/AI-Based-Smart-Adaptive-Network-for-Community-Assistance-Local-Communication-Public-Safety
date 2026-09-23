// ResQNet IndexedDB Store-and-Forward Sync Engine (Dexie.js)
import Dexie from 'dexie';

export const db = new Dexie('ResQNet_OfflineDB');

db.version(1).stores({
  outboundQueue: '++id, clientUuid, category, status, createdAt, retryCount',
  cachedIncidents: 'id, clientUuid, status, priorityScore, category, reportedAt',
  bleMeshBuffer: '++id, payloadHash, receivedAt, hopCount, forwarded'
});

export const SYNC_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  SYNCING: "SYNCING",
  SYNCED: "SYNCED"
};

/**
 * Save emergency report to IndexedDB outbound queue (Store & Forward)
 */
export async function saveOfflineReport(incidentData) {
  const record = {
    clientUuid: incidentData.clientUuid || `client-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    category: incidentData.category,
    title: incidentData.title,
    description: incidentData.description,
    peopleAffected: incidentData.peopleAffected || 1,
    injuries: incidentData.injuries || false,
    trapped: incidentData.trapped || false,
    firePresent: incidentData.firePresent || false,
    location: incidentData.location,
    createdAt: new Date().toISOString(),
    status: "PENDING_SYNC",
    retryCount: 0
  };

  const queueId = await db.outboundQueue.add(record);
  
  // Also cache locally for instant offline UI update
  await db.cachedIncidents.put({
    id: record.clientUuid,
    ...record,
    severity: "PENDING",
    priorityScore: 0,
    status: "REPORTED (OFFLINE QUEUED)"
  });

  return { queueId, record };
}

/**
 * Get all pending items in offline queue
 */
export async function getPendingOfflineQueue() {
  return await db.outboundQueue.where('status').equals('PENDING_SYNC').toArray();
}

/**
 * Simulate processing the offline sync queue when internet connection is restored
 */
export async function processOfflineQueue(onReportSynced) {
  const pendingItems = await getPendingOfflineQueue();
  if (pendingItems.length === 0) return { syncedCount: 0 };

  let syncedCount = 0;
  for (const item of pendingItems) {
    try {
      // Update queue status
      await db.outboundQueue.update(item.id, { status: "SYNCING" });
      
      // Simulate network API delay
      await new Promise(res => setTimeout(res, 600));

      if (onReportSynced) {
        await onReportSynced(item);
      }

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

  return { syncedCount };
}
