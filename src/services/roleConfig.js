export const VOLUNTEER_TYPES = {
  MEDICAL_RESPONDER: {
    label: 'Medical Responder',
    shortLabel: 'Doctor / First Aid',
    description: 'Doctor, nurse, paramedic, or trained first-aid responder.',
  },
  RESCUE_SQUAD: {
    label: 'Rescue Squad',
    shortLabel: 'Helping Squad / Rescuer',
    description: 'Search, rescue, evacuation, fire-support, and crowd-help team.',
  },
  MEDIC_RESOURCE_VEHICLE: {
    label: 'Medic & Resource Vehicle',
    shortLabel: 'Ambulance / Resource Van',
    description: 'Medic van, ambulance, relief vehicle, or resource transport unit.',
  },
  OTHER: {
    label: 'Other Volunteer',
    shortLabel: 'Other volunteer',
    description: 'Community support volunteer. Share your location when responding to incidents.',
  },
};

// Community messages are limited to management and approved volunteers in both the UI and local API.
export const ROLE_ACCESS = {
  GUEST: ['home', 'sos'],
  CITIZEN: ['home', 'sos', 'gis', 'ble', 'firstAid'],
  VOLUNTEER: ['home', 'volunteer', 'gis', 'notifications', 'messages', 'ble', 'firstAid'],
  MANAGEMENT: ['home', 'admin', 'sos', 'gis', 'command', 'completed', 'resources', 'notifications', 'messages', 'ai', 'ble'],
};

export const hasAccess = (role, feature) => (ROLE_ACCESS[role || 'GUEST'] || ROLE_ACCESS.GUEST).includes(feature);

export const defaultRouteForRole = (role) => ({
  CITIZEN: 'home',
  VOLUNTEER: 'volunteer',
  MANAGEMENT: 'home',
}[role] || 'home');
