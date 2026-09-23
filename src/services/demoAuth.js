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
};

export const DEMO_ACCOUNTS = [
  { role: 'CITIZEN', name: 'Aarav Citizen', email: 'citizen@resqnet.demo', password: 'Citizen@123', label: 'Citizen' },
  { role: 'VOLUNTEER', volunteerType: 'MEDICAL_RESPONDER', name: 'Dr. Anagha Joshi', email: 'doctor@resqnet.demo', password: 'Doctor@123', label: 'Medical Responder' },
  { role: 'VOLUNTEER', volunteerType: 'RESCUE_SQUAD', name: 'Pravin Mendhe', email: 'rescue@resqnet.demo', password: 'Rescue@123', label: 'Rescue Squad' },
  { role: 'VOLUNTEER', volunteerType: 'MEDIC_RESOURCE_VEHICLE', name: 'Amitabh Choudhury', email: 'vehicle@resqnet.demo', password: 'Vehicle@123', label: 'Medic & Resource Vehicle' },
  { role: 'AUTHORITY', name: 'Officer Sharma', email: 'authority@resqnet.demo', password: 'Authority@123', label: 'Authority' },
];

// Public SOS is intentionally available without a session. Dispatch and analytics remain protected.
export const ROLE_ACCESS = {
  GUEST: ['home', 'sos'],
  CITIZEN: ['home', 'sos', 'gis', 'ble'],
  VOLUNTEER: ['home', 'volunteer', 'gis', 'ble'],
  AUTHORITY: ['home', 'sos', 'gis', 'command', 'ai', 'ble'],
};

export const hasAccess = (role, feature) => (ROLE_ACCESS[role || 'GUEST'] || ROLE_ACCESS.GUEST).includes(feature);

export const defaultRouteForRole = (role) => ({
  CITIZEN: 'sos',
  VOLUNTEER: 'volunteer',
  AUTHORITY: 'command',
}[role] || 'home');
