// ResQNet Geospatial Haversine Engine & Skill/Resource Matcher

/**
 * Haversine formula to compute great-circle distance between two lat/lng coordinates in km
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const coordinates = [lat1, lon1, lat2, lon2].map((value) => (
    value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value)
  ));
  const [safeLat1, safeLon1, safeLat2, safeLon2] = coordinates;
  if (
    !coordinates.every(Number.isFinite) ||
    Math.abs(safeLat1) > 90 || Math.abs(safeLat2) > 90 ||
    Math.abs(safeLon1) > 180 || Math.abs(safeLon2) > 180
  ) return null;

  const R = 6371.0; // Earth's radius in kilometers
  const dLat = toRadians(safeLat2 - safeLat1);
  const dLon = toRadians(safeLon2 - safeLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(safeLat1)) *
      Math.cos(toRadians(safeLat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c + Number.EPSILON) * 100) / 100;
}

export function hasValidCoordinates(location) {
  if (!location || typeof location !== 'object') return false;
  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const lat = hasValue(location.lat) ? Number(location.lat) : NaN;
  const lng = hasValue(location.lng) ? Number(location.lng) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function toRadians(degree) {
  return (degree * Math.PI) / 180;
}

/**
 * Estimate ETA in minutes based on distance and transport mode
 */
export function estimateETA(distanceKm, mode = "ground") {
  const speeds = {
    ground: 32,  // km/h average emergency vehicle in city
    boat: 20,    // km/h flood rescue boat
    motorcycle: 40 // km/h fast volunteer responder
  };
  const speed = speeds[mode] || 30;
  const timeMinutes = (distanceKm / speed) * 60 + 2; // +2 min mobilization overhead
  return Math.max(2, Math.round(timeMinutes));
}

// Required skills mapping by incident category
const CATEGORY_REQUIRED_SKILLS = {
  "Road Accident": ["First Aid", "CPR", "Trauma Care", "Driving"],
  "Fire": ["Firefighting", "Search & Rescue", "Heavy Lifting"],
  "Medical Emergency": ["Medical", "Paramedic", "First Aid", "CPR"],
  "Flood": ["Swimming", "Boat Operation", "First Aid", "Search & Rescue"],
  "Building Collapse": ["Search & Rescue", "Heavy Lifting", "First Aid", "Technical Support"],
  "Electrical Emergency": ["Technical Support", "Generator Repair", "First Aid"],
  "Gas Leak": ["Search & Rescue", "First Aid"],
  "Other": ["First Aid", "Crowd Control"]
};

export const DEFAULT_VOLUNTEER_MATCH_WEIGHTS = Object.freeze({ distance: 40, skills: 40, availability: 20 });

export function isVolunteerVerified(volunteer) {
  return volunteer?.verified === true;
}

export function isVolunteerAvailable(volunteer) {
  if (volunteer?.status !== 'ACTIVE') return false;
  const availability = String(volunteer.availability || '').trim().toLowerCase();
  return !availability || ['available', 'available now', 'available for dispatch', 'on call', 'ready'].includes(availability);
}

function normalizeWeights(weights = DEFAULT_VOLUNTEER_MATCH_WEIGHTS) {
  const values = ['distance', 'skills', 'availability'].map((key) => Math.max(0, Number(weights[key]) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const source = total > 0 ? values : Object.values(DEFAULT_VOLUNTEER_MATCH_WEIGHTS);
  const sourceTotal = source.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(['distance', 'skills', 'availability'].map((key, index) => [key, source[index] / sourceTotal]));
}

/**
 * Match and rank volunteers for a specific incident using geospatial + skill composite scoring
 */
export function matchVolunteersForIncident(incident, volunteersList, weights = DEFAULT_VOLUNTEER_MATCH_WEIGHTS) {
  if (!hasValidCoordinates(incident?.location) || !Array.isArray(volunteersList)) return [];
  const { lat, lng } = incident.location;
  const requiredSkills = CATEGORY_REQUIRED_SKILLS[incident.category] || ["First Aid"];
  const normalizedWeights = normalizeWeights(weights);

  const ranked = volunteersList.filter((vol) => isVolunteerVerified(vol) && hasValidCoordinates(vol?.location)).map(vol => {
    const distanceKm = calculateHaversineDistance(lat, lng, vol.location.lat, vol.location.lng);
    if (distanceKm === null) return null;
    const vehicle = Array.isArray(vol.vehicle) ? vol.vehicle.join(' ') : String(vol.vehicle || '');
    const etaMinutes = estimateETA(distanceKm, vehicle.toLowerCase().includes("motorcycle") ? "motorcycle" : "ground");

    // Skill match fraction
    const volSkillSet = new Set((Array.isArray(vol.skills) ? vol.skills : [])
      .filter((skill) => typeof skill === 'string')
      .map((skill) => skill.toLowerCase()));
    const matchedSkills = requiredSkills.filter(req => volSkillSet.has(req.toLowerCase()));
    const skillMatchScore = Math.round((matchedSkills.length / Math.max(1, requiredSkills.length)) * 100);

    // Normalize distance against the responder's declared service radius.
    const maxSearchRadius = Number.isFinite(Number(vol.maxRadiusKm)) && Number(vol.maxRadiusKm) > 0
      ? Number(vol.maxRadiusKm)
      : 15.0;
    const distanceScore = Math.max(0, Math.round((1 - distanceKm / maxSearchRadius) * 100));
    const available = isVolunteerAvailable(vol);
    const score = Math.round(
      normalizedWeights.distance * distanceScore
      + normalizedWeights.skills * skillMatchScore
      + normalizedWeights.availability * (available ? 100 : 0)
    );

    return {
      volunteer: vol,
      distanceKm,
      etaMinutes,
      skillMatchScore,
      matchedSkills,
      requiredSkills,
      distanceScore,
      availabilityScore: available ? 100 : 0,
      available,
      compositeScore: score,
      scoreBreakdown: {
        distance: Math.round(normalizedWeights.distance * distanceScore),
        skills: Math.round(normalizedWeights.skills * skillMatchScore),
        availability: Math.round(normalizedWeights.availability * (available ? 100 : 0)),
      },
      withinRadius: distanceKm <= maxSearchRadius
    };
  });

  // Keep unavailable responders visible for transparency, but rank all available
  // responders ahead of them and never allow an unavailable responder to be selected.
  return ranked
    .filter((match) => match?.withinRadius)
    .sort((a, b) => Number(b.available) - Number(a.available)
      || b.compositeScore - a.compositeScore
      || a.distanceKm - b.distanceKm);
}

// Required resource types per category
const CATEGORY_REQUIRED_RESOURCES = {
  "Road Accident": ["Ambulance", "Fire Truck"],
  "Fire": ["Fire Truck", "Ambulance", "Generator"],
  "Medical Emergency": ["Ambulance"],
  "Flood": ["Rescue Boat", "Shelter", "Generator", "Ambulance"],
  "Building Collapse": ["Fire Truck", "Ambulance", "Generator", "Shelter"],
  "Electrical Emergency": ["Generator", "Fire Truck"],
  "Other": ["Ambulance", "Shelter"]
};

/**
 * Match and rank emergency resources for an incident
 */
export function matchResourcesForIncident(incident, resourcesList) {
  if (!hasValidCoordinates(incident?.location) || !Array.isArray(resourcesList)) return [];
  const { lat, lng } = incident.location;
  const neededTypes = CATEGORY_REQUIRED_RESOURCES[incident.category] || ["Ambulance"];

  const matches = resourcesList.filter((res) => hasValidCoordinates(res?.location)).map(res => {
    const distanceKm = calculateHaversineDistance(lat, lng, res.location.lat, res.location.lng);
    if (distanceKm === null) return null;
    const etaMinutes = estimateETA(distanceKm, res.type === "Rescue Boat" ? "boat" : "ground");
    const isNeededType = neededTypes.includes(res.type);

    return {
      resource: res,
      distanceKm,
      etaMinutes,
      isNeededType,
      score: isNeededType ? Math.max(1, 100 - distanceKm * 3) : Math.max(0, 50 - distanceKm * 3)
    };
  });

  return matches
    .filter(m => m && m.resource.status === "AVAILABLE")
    .sort((a, b) => (b.isNeededType ? 1 : 0) - (a.isNeededType ? 1 : 0) || a.distanceKm - b.distanceKm);
}
