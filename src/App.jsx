import React, { useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import GISMapView from './components/GISMapView';
import ResQNetLanding from './components/ResQNetLanding';
import CitizenSOSPortal from './components/CitizenSOSPortal';
import IncidentTriageDashboard from './components/IncidentTriageDashboard';
import IncidentDetailPage from './components/IncidentDetailPage';
import CompletedIncidents from './components/CompletedIncidents';
import OverviewDashboard from './components/OverviewDashboard';
import VolunteerDashboard from './components/VolunteerDashboard';
import VolunteerMatcherModal from './components/VolunteerMatcherModal';
import AIMetricsDashboard from './components/AIMetricsDashboard';
import OfflineBLESyncPanel from './components/OfflineBLESyncPanel';
import LoginModal from './components/LoginModal';
import WelcomeOnboarding from './components/WelcomeOnboarding';
import CitizenHomeDashboard from './components/CitizenHomeDashboard';
import ResourceManagement from './components/ResourceManagement';
import NotificationCenter from './components/NotificationCenter';
import CommunityMessages from './components/CommunityMessages';
import AdminDashboard from './components/AdminDashboard';
import FirstAidAssistant from './components/FirstAidAssistant';
import { INITIAL_INCIDENTS, INITIAL_RESOURCES, INITIAL_VOLUNTEERS } from './services/mockData';
import { predictIncident } from './services/nlpEngine';
import { createResponsePlan, isResponsePlanComplete } from './services/responsePlan';
import { getCachedIncidents, processOfflineQueue, queueIncidentUpdate, saveIncidentToCache, saveOfflineReport } from './services/offlineStore';
import { fetchMyServerIncidents, fetchServerIncidents, subscribeToIncidentUpdates, syncIncidentToServer, updateIncidentOnServer } from './services/incidentApi';
import { defaultRouteForRole } from './services/roleConfig';
import { restoreAuthSession, signOut as signOutUser } from './services/localAuth';
import { createResourceUnit, fetchOperationalUnits, saveOperationalUnit, subscribeToOperationalUpdates } from './services/localData';
import { isVolunteerAvailable, isVolunteerVerified } from './services/geoMatcher';

/** Rebuilds temporary browser URLs for any media restored from the local database. */
function restoreIncidentMedia(incident) {
  return {
    ...incident,
    media: (incident.media || []).map((item) => ({
      ...item,
      url: item.blob instanceof Blob ? URL.createObjectURL(item.blob) : item.dataUrl || item.url || '',
    })),
  };
}

const STATUS_TIMESTAMP_FIELDS = {
  VERIFIED: 'verifiedAt',
  ASSIGNED: 'assignedAt',
  RESPONDING: 'respondingAt',
  RESOLVED: 'resolvedAt',
};

export default function App() {
  // Shared application state: selected page, signed-in account, and response data.
  const [activeTab, setActiveTab] = useState('home');
  const [mapRouteGuide, setMapRouteGuide] = useState(null);
  const [reportCategory, setReportCategory] = useState('Road Accident');
  const [reportLocation, setReportLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  // Onboarding is available on demand; never block emergency actions on first visit.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userSession, setUserSession] = useState(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [incidents, setIncidents] = useState(() => INITIAL_INCIDENTS);
  const [myReports, setMyReports] = useState([]);
  const [volunteers, setVolunteers] = useState(() => INITIAL_VOLUNTEERS);
  const [resources, setResources] = useState(() => INITIAL_RESOURCES);
  const [dispatchIncident, setDispatchIncident] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const lastLocationPersistedAt = useRef(0);

  // Saves the onboarding dismissal when browser storage is available.
  const completeOnboarding = () => {
    try { localStorage.setItem('resqnet-onboarding-complete', 'true'); } catch { /* Onboarding can still be dismissed when storage is unavailable. */ }
    setShowOnboarding(false);
  };

  // A volunteer dashboard is available only when this account has a volunteer profile.
  const hasVolunteerProfile = userSession?.role === 'VOLUNTEER'
    && volunteers.some((volunteer) => volunteer.id === userSession.volunteerId || volunteer.name === userSession.name);

  // Restore previously submitted reports from the local cache when the app starts.
  useEffect(() => {
    let cancelled = false;
    const cachedReports = getCachedIncidents('local-anonymous');
    const serverReports = Promise.resolve([]);
    Promise.allSettled([cachedReports, serverReports]).then((results) => {
      if (cancelled) return;
      const [cacheResult, serverResult] = results;
      if (cacheResult.status === 'rejected') console.error('Could not restore saved incidents from IndexedDB:', cacheResult.reason);
      if (serverResult.status === 'rejected') console.warn('Incident API is unavailable; restoring browser-cached reports only:', serverResult.reason);
      if (serverResult.status === 'fulfilled') setLastSyncedAt(new Date().toISOString());
      const cached = cacheResult.status === 'fulfilled' ? cacheResult.value : [];
      const serverIncidents = serverResult.status === 'fulfilled' ? serverResult.value : [];
      // Local cache fills gaps while the server record wins when both contain the same incident.
      const savedReports = [...cached, ...serverIncidents]
        .filter((incident) => incident?.id && incident.category && incident.location)
        .map((incident) => restoreIncidentMedia({ ...incident, isLocalReport: true }));
      setIncidents((current) => {
        const byId = new Map(current.map((incident) => [incident.id, incident]));
        savedReports.forEach((incident) => byId.set(incident.id, incident));
        return [...byId.values()].sort((a, b) => new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0));
      });
      setMyReports((current) => {
        const byId = new Map([...savedReports, ...current].map((incident) => [incident.id, incident]));
        return [...byId.values()].sort((a, b) => new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0));
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Keep the connection state in sync with browser online/offline events.
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Clear route instructions when the user leaves the map.
  useEffect(() => {
    if (activeTab !== 'gis') setMapRouteGuide(null);
  }, [activeTab]);

  // Restore a locally saved account and route it to the correct workspace.
  useEffect(() => {
    let cancelled = false;
    restoreAuthSession().then((session) => {
      if (!cancelled && session) {
        setUserSession(session);
        if (session.requestedRole === 'VOLUNTEER') setAccountNotice('Your volunteer account request is awaiting management review. You can use limited User access while it is pending.');
        setActiveTab(defaultRouteForRole(session.role));
      }
    }).catch((error) => console.warn('Could not restore the local Management session:', error));
    return () => { cancelled = true; };
  }, []);

  // Listen for incident changes made by other connected clients.
  useEffect(() => subscribeToIncidentUpdates((incoming) => {
    setLastSyncedAt(new Date().toISOString());
    const saved = restoreIncidentMedia({ ...incoming, isLocalReport: true });
    setIncidents((current) => {
      const index = current.findIndex((incident) => incident.clientUuid === saved.clientUuid || incident.id === saved.id);
      if (index < 0) return [saved, ...current];
      return current.map((incident, currentIndex) => currentIndex === index ? { ...incident, ...saved } : incident);
    });
    setMyReports((current) => current.map((incident) => incident.clientUuid === saved.clientUuid || incident.id === saved.id
      ? { ...incident, ...saved }
      : incident));
  }), []);

  // Load the current account's shared and offline incident records.
  useEffect(() => {
    if (!userSession?.id) return undefined;
    let cancelled = false;
    const serverIncidentsRequest = userSession.role === 'CITIZEN' ? fetchMyServerIncidents() : fetchServerIncidents();
    Promise.allSettled([serverIncidentsRequest, getCachedIncidents(userSession.id)]).then((results) => {
      if (cancelled) return;
      const [serverResult, cacheResult] = results;
      if (serverResult.status === 'rejected') console.warn('Could not load shared incidents:', serverResult.reason);
      if (cacheResult.status === 'rejected') console.warn('Could not load this account\'s offline incidents:', cacheResult.reason);
      const saved = [
        ...(cacheResult.status === 'fulfilled' ? cacheResult.value : []),
        ...(serverResult.status === 'fulfilled' ? serverResult.value : []),
      ];
      setLastSyncedAt(new Date().toISOString());
      const restored = saved.filter((incident) => incident?.id).map((incident) => restoreIncidentMedia({ ...incident, isLocalReport: true }));
      setIncidents((current) => {
        const byId = new Map(current.map((incident) => [incident.id, incident]));
        restored.forEach((incident) => byId.set(incident.id, { ...byId.get(incident.id), ...incident }));
        return [...byId.values()].sort((a, b) => new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0));
      });
      setMyReports((current) => {
        const byId = new Map(current.map((incident) => [incident.id, incident]));
        restored.forEach((incident) => byId.set(incident.id, { ...byId.get(incident.id), ...incident }));
        return [...byId.values()];
      });
    }).catch((error) => console.warn('Could not load the signed-in incident view:', error));
    return () => { cancelled = true; };
  }, [userSession?.id]);

  // Restore volunteer and resource availability from the local operations store.
  useEffect(() => {
    if (!userSession?.id) return undefined;
    let cancelled = false;
    fetchOperationalUnits(userSession.role).then((snapshot) => {
      if (cancelled || !snapshot) return;
      const savedUnits = [...snapshot.volunteers, ...snapshot.resources];
      if (!savedUnits.length) {
        Promise.all([...INITIAL_VOLUNTEERS, ...INITIAL_RESOURCES].map((unit) => saveOperationalUnit(unit)))
          .then(() => {
            if (!cancelled) { setVolunteers(INITIAL_VOLUNTEERS); setResources(INITIAL_RESOURCES); }
          }).catch((error) => console.warn('Could not seed local response units:', error));
        return;
      }
      setVolunteers(snapshot.volunteers.length ? snapshot.volunteers : INITIAL_VOLUNTEERS);
      setResources(snapshot.resources.length ? snapshot.resources : INITIAL_RESOURCES);
    }).catch((error) => console.warn('Could not load shared volunteer and asset state:', error));
    return () => { cancelled = true; };
  }, [userSession?.id]);

  // Apply volunteer and resource updates received from other management clients.
  useEffect(() => subscribeToOperationalUpdates((unit) => {
    if (unit.unitType === 'VOLUNTEER') setVolunteers((current) => current.some((item) => item.id === unit.id)
      ? current.map((item) => item.id === unit.id ? { ...item, ...unit } : item)
      : [...current, unit]);
    else setResources((current) => current.some((item) => item.id === unit.id)
      ? current.map((item) => item.id === unit.id ? { ...item, ...unit } : item)
      : [...current, unit]);
  }), []);

  // Keep locally owned incidents persisted after any UI update.
  useEffect(() => {
    incidents.filter((incident) => incident.isLocalReport).forEach((incident) => {
      saveIncidentToCache(incident).catch((error) => {
        console.error('Could not persist incident changes to IndexedDB:', error);
      });
    });
  }, [incidents]);

  // Add SOS reports received from nearby Android phones to the local incident list.
  useEffect(() => {
    const handleRelayedIncident = (event) => {
      const incoming = event.detail;
      if (!incoming?.id || !incoming.clientUuid) return;
      const incident = restoreIncidentMedia({
        ...incoming,
        isLocalReport: true,
        status: incoming.status || 'REPORTED',
        auditTimeline: [...(incoming.auditTimeline || []), {
          time: new Date().toLocaleTimeString(),
          event: 'SOS received over nearby volunteer BLE relay',
          by: 'AI-Based responder mesh',
        }],
      });
      setIncidents((current) => current.some((item) => item.clientUuid === incident.clientUuid)
        ? current
        : [incident, ...current]);
      saveOfflineReport(incident).catch((error) => console.error('Could not queue BLE-relayed incident for server sync:', error));
    };
    window.addEventListener('resqnet:incident', handleRelayedIncident);
    return () => window.removeEventListener('resqnet:incident', handleRelayedIncident);
  }, []);

  // Create an incident, save it locally, then try the server when connected.
  const handleReportSubmit = async (report) => {
    const prediction = predictIncident({ ...report, existingIncidents: incidents });
    const incident = {
      ...report,
      id: `INC-${Date.now()}`,
      clientUuid: globalThis.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      isLocalReport: true,
      reporterName: userSession?.name || 'Citizen',
      reporterId: userSession?.id || 'local-anonymous',
      category: prediction.category,
      ...prediction,
      aiRecommendation: {
        category: prediction.category,
        severity: prediction.severity,
        priorityBand: prediction.priorityBand,
        priorityScore: prediction.priorityScore,
        confidence: prediction.confidence,
        priorityReasons: prediction.priorityReasons,
      },
      triageOverride: null,
      status: isOnline ? 'REPORTED' : 'PENDING_SYNC',
      reportedAt: new Date().toISOString(),
      assignedVolunteers: [],
      assignedResources: [],
      auditTimeline: [{
        time: new Date().toLocaleTimeString(),
        event: `Emergency SOS Reported (AI priority: ${prediction.priorityScore}/100)`,
        by: userSession?.name || 'Citizen',
      }],
    };

    setIncidents((current) => [incident, ...current]);
    setMyReports((current) => [incident, ...current]);

    if (isOnline) {
      try {
        const savedIncident = await syncIncidentToServer(incident);
        window.ResQNetNative?.markServerConfirmed?.(savedIncident.clientUuid || incident.clientUuid);
        setLastSyncedAt(new Date().toISOString());
        const restored = restoreIncidentMedia({ ...savedIncident, isLocalReport: true });
        setIncidents((current) => current.map((item) => item.clientUuid === restored.clientUuid ? restored : item));
        setMyReports((current) => current.map((item) => item.clientUuid === restored.clientUuid ? restored : item));
        return { queued: false, clientUuid: savedIncident.clientUuid || incident.clientUuid };
      } catch (error) {
        console.warn('Incident API is unavailable; keeping the report in the offline queue:', error);
        const pending = { ...incident, status: 'PENDING_SYNC' };
        setIncidents((current) => current.map((item) => item.clientUuid === pending.clientUuid ? pending : item));
        setMyReports((current) => current.map((item) => item.clientUuid === pending.clientUuid ? pending : item));
        try {
          await saveOfflineReport(pending);
          return { queued: true, requiresSignIn: false, clientUuid: pending.clientUuid };
        } catch (queueError) {
          console.error('Could not queue the report for later sync:', queueError);
          throw new Error(`The report could not be saved locally: ${queueError.message || 'device storage is unavailable'}`);
        }
      }
    } else {
      try {
        await saveOfflineReport(incident);
      } catch (error) {
        console.error('Could not save the offline incident to IndexedDB:', error);
        throw new Error(`The report could not be saved locally: ${error.message || 'device storage is unavailable'}`);
      }
      if (window.ResQNetNative?.saveIncident) {
        syncIncidentToServer(incident).catch((error) => {
          console.error('Could not hand the offline incident to the Android relay:', error);
        });
      }
      return { queued: true, requiresSignIn: false, clientUuid: incident.clientUuid };
    }
  };

  // Store the account session and prepare an initial volunteer record if needed.
  const handleLogin = (session) => {
    setUserSession(session);
    setShowLogin(false);
    setAccountNotice(session.requestedRole === 'VOLUNTEER'
      ? 'Your volunteer account request has been sent for management review. You can use limited User access while it is pending.'
      : '');
    if (session.role === 'VOLUNTEER') {
      const volunteer = volunteers.find((item) => item.id === session.volunteerId || item.name === session.name) || {
        id: session.volunteerId,
        unitType: 'VOLUNTEER',
        name: session.name,
        volunteerType: session.volunteerType || 'OTHER',
        skills: session.volunteerType === 'MEDICAL_RESPONDER' ? ['Medical', 'First Aid', 'CPR'] : session.volunteerType === 'RESCUE_SQUAD' ? ['Search & Rescue', 'First Aid'] : ['Community Support'],
        maxRadiusKm: 15,
        rating: 0,
        missionsCount: 0,
        location: null,
      };
      const onlineVolunteer = { ...volunteer, verified: true, status: 'ACTIVE', availability: 'Available Now', lastSeenAt: new Date().toISOString() };
      setVolunteers((previous) => previous.some((item) => item.id === onlineVolunteer.id)
        ? previous.map((item) => item.id === onlineVolunteer.id ? onlineVolunteer : item)
        : [onlineVolunteer, ...previous]);
      saveOperationalUnit(onlineVolunteer).catch((error) => console.warn('Could not publish volunteer availability:', error));
      const assignment = incidents.find((incident) => (incident.assignedVolunteers || []).includes(onlineVolunteer.id));
      setActiveAssignment(assignment ? { incidentId: assignment.id, volunteerId: onlineVolunteer.id } : null);
    }
    setActiveTab(defaultRouteForRole(session.role));
  };

  // Update lifecycle status in the UI and persist the change for other clients.
  const handleIncidentStatusUpdate = (incidentId, status) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident || incident.status === status) return;
    const at = new Date().toISOString();
    const field = STATUS_TIMESTAMP_FIELDS[status];
    const changes = {
      status,
      lifecycle: {
        ...(incident.lifecycle || {}),
        reportedAt: incident.lifecycle?.reportedAt || incident.reportedAt,
        ...(['ASSIGNED', 'RESPONDING'].includes(status) && !incident.lifecycle?.assignedAt ? { assignedAt: at } : {}),
        ...(field && !incident.lifecycle?.[field] ? { [field]: at } : {}),
      },
      auditTimeline: [...(incident.auditTimeline || []), {
        at,
        time: new Date(at).toLocaleTimeString(),
        event: `Status updated to ${status}`,
        by: userSession?.name || 'Management room',
      }],
    };
    persistIncidentChanges(incident, changes);
  };

  // Record a management override alongside the AI recommendation for auditability.
  const handleTriageOverride = (incidentId, { category, priorityBand, reason }) => {
    if (userSession?.role !== 'MANAGEMENT') return;
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;
    const at = new Date().toISOString();
    const scoreByBand = { P0: 95, P1: 80, P2: 60, P3: 35 };
    const severityByBand = { P0: 'CRITICAL', P1: 'HIGH', P2: 'MEDIUM', P3: 'LOW' };
    const categoryRecommendation = predictIncident({ ...incident, category, existingIncidents: [] });
    const priorAiRecommendation = incident.aiRecommendation || {
      category: incident.category,
      severity: incident.severity,
      priorityBand: incident.priorityBand,
      priorityScore: incident.priorityScore,
      confidence: incident.confidence,
      priorityReasons: incident.priorityReasons || [],
    };
    const changes = {
      category,
      priorityBand,
      priorityScore: scoreByBand[priorityBand],
      severity: severityByBand[priorityBand],
      recommendedResources: categoryRecommendation.recommendedResources,
      aiRecommendation: priorAiRecommendation,
      triageOverride: { category, priorityBand, reason: reason.trim(), by: userSession.name, at },
      auditTimeline: [...(incident.auditTimeline || []), {
        at,
        time: new Date(at).toLocaleTimeString(),
        event: `Human triage override: ${category}, ${priorityBand}. Reason: ${reason.trim()}`,
        by: userSession.name || userSession.role,
      }],
    };
    persistIncidentChanges(incident, changes);
  };

  // Update one response-plan checklist item without replacing the other tasks.
  const handleToggleResponseTask = (incidentId, taskId) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;
    const at = new Date().toISOString();
    const tasks = Array.isArray(incident.responseTasks) ? incident.responseTasks : createResponsePlan(incident);
    const changes = {
      responseTasks: tasks.map((task) => task.id !== taskId ? task : {
        ...task,
        completed: !task.completed,
        completedAt: task.completed ? null : at,
        completedBy: task.completed ? null : (userSession?.name || 'Management room'),
      }),
      auditTimeline: [...(incident.auditTimeline || []), {
        at,
        time: new Date(at).toLocaleTimeString(),
        event: `${tasks.find((task) => task.id === taskId)?.completed ? 'Reopened' : 'Completed'} response task: ${tasks.find((task) => task.id === taskId)?.title || taskId}`,
        by: userSession?.name || 'Management room',
      }],
    };
    persistIncidentChanges(incident, changes);
  };

  // Add a new operational resource and share it with the local operations store.
  const handleCreateResource = async (resource) => {
    if (userSession?.role !== 'MANAGEMENT') throw new Error('Resource registration is available to the Management room.');
    const created = await createResourceUnit(resource);
    setResources((current) => current.some((item) => item.id === created.id) ? current : [created, ...current]);
    return created;
  };

  // Save changes to an existing resource and update the current screen.
  const handleUpdateResource = async (resource) => {
    if (userSession?.role !== 'MANAGEMENT') throw new Error('Only the Management room can update resource availability.');
    const previous = resources.find((item) => item.id === resource.id);
    setResources((current) => current.map((item) => item.id === resource.id ? resource : item));
    try {
      const saved = await saveOperationalUnit(resource);
      if (!saved) throw new Error('The resource was not saved. Check your connection and Management room account.');
      setResources((current) => current.map((item) => item.id === resource.id ? { ...resource, ...saved } : item));
    } catch (error) {
      setResources((current) => current.map((item) => item.id === resource.id ? previous || item : item));
      throw error;
    }
  };

  // Apply incident changes locally and queue them if the server is unavailable.
  const persistIncidentChanges = (incident, changes) => {
    const updated = { ...incident, ...changes, isLocalReport: true, updatedAt: new Date().toISOString() };
    setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, ...updated } : item));
    setMyReports((current) => current.map((item) => item.id === incident.id ? { ...item, ...updated } : item));
    saveIncidentToCache(updated).catch((error) => console.error('Could not cache incident changes:', error));

    if (navigator.onLine) {
      updateIncidentOnServer(incident.id, changes, updated).then((saved) => {
        setLastSyncedAt(new Date().toISOString());
        const restored = restoreIncidentMedia({ ...saved, isLocalReport: true });
        setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, ...restored } : item));
        setMyReports((current) => current.map((item) => item.id === incident.id ? { ...item, ...restored } : item));
        saveIncidentToCache(restored).catch((error) => console.error('Could not cache the saved incident:', error));
      }).catch((error) => {
        console.warn('Incident changes remain queued for sync:', error);
        queueIncidentUpdate(updated).catch((queueError) => console.error('Could not queue the incident update:', queueError));
      });
    } else {
      queueIncidentUpdate(updated).catch((error) => console.error('Could not queue the incident update:', error));
    }
  };

  // Create an authorized dispatch assignment and update responder availability.
  const handleAssignDispatch = ({ incidentId, volunteer, resource }) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;
    if (userSession?.role !== 'MANAGEMENT') {
      window.alert('Only the Management room dispatcher can make an official responder assignment.');
      return;
    }
    if (volunteer && (!isVolunteerVerified(volunteer) || !isVolunteerAvailable(volunteer))) {
      window.alert('Choose a verified responder who is currently available.');
      return;
    }
    if (resource && resource.status !== 'AVAILABLE') {
      window.alert('Choose an available resource.');
      return;
    }
    const volunteerIds = volunteer ? [...new Set([...(incident.assignedVolunteers || []), volunteer.id])] : incident.assignedVolunteers || [];
    const resourceIds = resource ? [...new Set([...(incident.assignedResources || []), resource.id])] : incident.assignedResources || [];
    const status = volunteer || resource ? 'RESPONDING' : 'ASSIGNED';

    const at = new Date().toISOString();
    const statusTimeField = STATUS_TIMESTAMP_FIELDS[status];
    const changes = {
      status,
      assignedVolunteers: volunteerIds,
      assignedResources: resourceIds,
      lifecycle: {
        ...(incident.lifecycle || {}),
        reportedAt: incident.lifecycle?.reportedAt || incident.reportedAt,
        ...(['ASSIGNED', 'RESPONDING'].includes(status) && !incident.lifecycle?.assignedAt ? { assignedAt: at } : {}),
        ...(statusTimeField && !incident.lifecycle?.[statusTimeField] ? { [statusTimeField]: at } : {}),
      },
      auditTimeline: [...(incident.auditTimeline || []), {
        at,
        time: new Date(at).toLocaleTimeString(),
        event: `Dispatch assigned${volunteer ? ` to ${volunteer.name}` : ''}${resource ? ` with ${resource.name}` : ''}`,
        by: userSession?.name || 'Management room',
      }],
    };
    persistIncidentChanges(incident, changes);
    if (volunteer) {
      const dispatchedVolunteer = { ...volunteer, status: 'DISPATCHED', availability: `On Mission (${incidentId})` };
      setVolunteers((current) => current.map((item) => item.id === volunteer.id
        ? dispatchedVolunteer
        : item));
      saveOperationalUnit(dispatchedVolunteer).catch((error) => console.warn('Could not save volunteer dispatch status:', error));
    }
    if (resource) {
      const dispatchedResource = { ...resource, status: 'DISPATCHED' };
      setResources((current) => current.map((item) => item.id === resource.id
        ? dispatchedResource
        : item));
      saveOperationalUnit(dispatchedResource).catch((error) => console.warn('Could not save asset dispatch status:', error));
    }
    setActiveAssignment({ incidentId, volunteerId: volunteer?.id, vehicleResourceId: resource?.id });
  };

  // Volunteers may change their availability only after management verification.
  const handleVolunteerAvailabilityChange = (available) => {
    if (userSession?.role !== 'VOLUNTEER' || !userSession.volunteerId) return;
    const volunteer = volunteers.find((item) => item.id === userSession.volunteerId);
    if (!volunteer || !isVolunteerVerified(volunteer)) return;
    if (volunteer.status === 'DISPATCHED') {
      window.alert('You are assigned to an active incident. Ask the dispatcher to release you before changing availability.');
      return;
    }
    const updated = {
      ...volunteer,
      status: available ? 'ACTIVE' : 'UNAVAILABLE',
      availability: available ? 'Available Now' : 'Unavailable',
      availabilityUpdatedAt: new Date().toISOString(),
    };
    setVolunteers((current) => current.map((item) => item.id === updated.id ? updated : item));
    saveOperationalUnit(updated).catch((error) => {
      console.warn('Could not save volunteer availability:', error);
      window.alert('Availability could not be shared with dispatch. Please try again when connected.');
    });
  };

  // Mark an offline report server-confirmed after the queue successfully syncs.
  const handleReportSynced = async (queuedReport) => {
    window.ResQNetNative?.markServerConfirmed?.(queuedReport.clientUuid || queuedReport.id);
    setLastSyncedAt(new Date().toISOString());
    const saved = restoreIncidentMedia({ ...queuedReport, isLocalReport: true });
    setIncidents((current) => current.map((incident) => incident.clientUuid !== queuedReport.clientUuid ? incident : { ...incident, ...saved }));
    setMyReports((current) => current.map((incident) => incident.clientUuid !== queuedReport.clientUuid ? incident : { ...incident, ...saved }));
    await saveIncidentToCache(saved);
  };

  useEffect(() => {
    const syncPendingChanges = () => {
      if (!navigator.onLine) return;
      processOfflineQueue(handleReportSynced).catch((error) => console.warn('Could not sync pending incident changes:', error));
    };
    window.addEventListener('online', syncPendingChanges);
    if (navigator.onLine) syncPendingChanges();
    return () => window.removeEventListener('online', syncPendingChanges);
  }, [userSession?.id]);

  // Share a verified volunteer's latest location for distance-aware dispatch.
  useEffect(() => {
    if (userSession?.role !== 'VOLUNTEER' || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        const unit = volunteers.find((volunteer) => volunteer.id === userSession.volunteerId || volunteer.name === userSession.name);
        setVolunteers((previous) => previous.map((volunteer) => volunteer.id === userSession.volunteerId || volunteer.name === userSession.name
          ? { ...volunteer, location }
          : volunteer));
        if (unit && Date.now() - lastLocationPersistedAt.current > 30000) {
          lastLocationPersistedAt.current = Date.now();
          saveOperationalUnit({ ...unit, location, lastSeenAt: new Date().toISOString() }).catch((error) => console.warn('Could not sync volunteer location:', error));
        }
    },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [userSession?.name, userSession?.role, userSession?.volunteerId, hasVolunteerProfile]);

  // Render the navigation shell, then the page allowed for the current account.
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-red-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        userSession={userSession}
        onShowOnboarding={() => setShowOnboarding(true)}
        onOpenLogin={() => { completeOnboarding(); setShowLogin(true); }}
        onLogout={() => {
          signOutUser().catch((error) => console.error('Could not end the local account session:', error));
          if (userSession?.role === 'VOLUNTEER') {
            setVolunteers((previous) => previous.map((volunteer) => volunteer.id === userSession.volunteerId || volunteer.name === userSession.name
              ? { ...volunteer, status: 'OFFLINE', availability: 'Signed out' }
              : volunteer));
          }
          setUserSession(null);
          setActiveTab('home');
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {accountNotice && <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-700/50 bg-amber-950/40 p-3 text-sm text-amber-100" role="status"><p>{accountNotice}</p><button type="button" onClick={() => setAccountNotice('')} className="shrink-0 rounded px-2 text-amber-200 hover:bg-amber-900/60" aria-label="Dismiss account notice">✕</button></div>}
        {activeTab === 'home' && userSession?.role === 'MANAGEMENT'
          ? <OverviewDashboard incidents={incidents} volunteers={volunteers} resources={resources} isOnline={isOnline} lastSyncedAt={lastSyncedAt} onOpenTriage={() => setActiveTab('command')} onOpenMap={() => setActiveTab('gis')} onCreateIncident={() => setActiveTab('sos')} />
          : activeTab === 'home' && userSession?.role === 'CITIZEN'
            ? <CitizenHomeDashboard
              userSession={userSession}
              isOnline={isOnline}
              reports={myReports}
              onQuickReport={handleReportSubmit}
              onCreateReport={(category, location = null) => { setReportCategory(category); setReportLocation(location); setActiveTab('sos'); }}
              onOpenReports={() => setActiveTab('sos')}
            />
            : activeTab === 'home' && <ResQNetLanding resources={resources} isOnline={isOnline} onOpenMap={() => setActiveTab('gis')} onCreateIncident={() => setActiveTab('sos')} onShowOnboarding={() => setShowOnboarding(true)} />}
        {activeTab === 'admin' && userSession?.role === 'MANAGEMENT' && <AdminDashboard resources={resources} onOpenResources={() => setActiveTab('resources')} onOpenAI={() => setActiveTab('ai')} />}
        {activeTab === 'sos' && <CitizenSOSPortal onReportSubmit={handleReportSubmit} myReports={myReports} isOnline={isOnline} initialCategory={reportCategory} initialLocation={reportLocation} />}
        {activeTab === 'firstAid' && ['CITIZEN', 'VOLUNTEER'].includes(userSession?.role) && <FirstAidAssistant />}
        {activeTab === 'gis' && <GISMapView incidents={incidents.filter((incident) => !isResponsePlanComplete(incident))} resources={resources} volunteers={volunteers} activeVolunteerName={userSession?.role === 'VOLUNTEER' ? userSession.name : null} focusIncident={mapRouteGuide?.incident || null} routeGuide={mapRouteGuide} />}
        {activeTab === 'command' && userSession?.role === 'MANAGEMENT' && <IncidentTriageDashboard incidents={incidents.filter((incident) => !isResponsePlanComplete(incident))} volunteers={volunteers} resources={resources} onUpdateStatus={handleIncidentStatusUpdate} onSelectForDispatch={setDispatchIncident} onOpenIncident={(incident) => { setSelectedIncidentId(incident.id); setActiveTab('incident'); }} />}
        {activeTab === 'incident' && <IncidentDetailPage
          incident={incidents.find((item) => item.id === selectedIncidentId)}
          resources={resources}
          volunteers={volunteers}
          onBack={() => setActiveTab('command')}
          onToggleTask={(taskId) => handleToggleResponseTask(selectedIncidentId, taskId)}
          onDispatch={userSession?.role === 'MANAGEMENT' ? setDispatchIncident : undefined}
          onOverrideTriage={(override) => handleTriageOverride(selectedIncidentId, override)}
          canOverrideTriage={userSession?.role === 'MANAGEMENT'}
        />}
        {activeTab === 'completed' && <CompletedIncidents
          incidents={incidents}
          volunteers={volunteers}
          resources={resources}
          onOpenIncident={(incident) => { setSelectedIncidentId(incident.id); setActiveTab('incident'); }}
        />}
        {activeTab === 'resources' && userSession?.role === 'MANAGEMENT' && <ResourceManagement resources={resources} onCreateResource={handleCreateResource} onUpdateResource={handleUpdateResource} />}
        {activeTab === 'notifications' && ['MANAGEMENT', 'VOLUNTEER'].includes(userSession?.role) && <NotificationCenter incidents={incidents} isOnline={isOnline} onOpenActivity={() => setActiveTab(userSession.role === 'MANAGEMENT' ? 'command' : 'volunteer')} />}
        {activeTab === 'messages' && ['MANAGEMENT', 'VOLUNTEER'].includes(userSession?.role) && <CommunityMessages userSession={userSession} isOnline={isOnline} />}
        {activeTab === 'volunteer' && userSession?.role === 'VOLUNTEER' && <VolunteerDashboard userSession={userSession} incidents={incidents} volunteers={volunteers} resources={resources} activeAssignment={activeAssignment} onOpenMap={(guide) => { setMapRouteGuide(guide || null); setActiveTab('gis'); }} onAvailabilityChange={handleVolunteerAvailabilityChange} />}
        {activeTab === 'ai' && <AIMetricsDashboard />}
        {activeTab === 'ble' && <OfflineBLESyncPanel isOnline={isOnline} onReportSynced={handleReportSynced} />}
      </main>

      {dispatchIncident && userSession?.role === 'MANAGEMENT' && <VolunteerMatcherModal incident={dispatchIncident} volunteers={volunteers} resources={resources} onAssignDispatch={handleAssignDispatch} onClose={() => setDispatchIncident(null)} />}
      {showOnboarding && <WelcomeOnboarding onComplete={completeOnboarding} onOpenLogin={() => { completeOnboarding(); setShowLogin(true); }} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}

      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 bg-slate-950/60">
        <p>AI-Based – Smart Adaptive Network for Community Assistance, Local Communication & Public Safety | Nagpur, Maharashtra Zone | Final Year Engineering Project 2026–2027</p>
      </footer>
    </div>
  );
}
