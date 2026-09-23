// ResQNet Geospatial Haversine Engine & Skill/Resource Matcher

/**
 * Haversine formula to compute great-circle distance between two lat/lng coordinates in km
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c + Number.EPSILON) * 100) / 100;
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

/**
 * Match and rank volunteers for a specific incident using geospatial + skill composite scoring
 */
export function matchVolunteersForIncident(incident, volunteersList) {
  const { lat, lng } = incident.location;
  const requiredSkills = CATEGORY_REQUIRED_SKILLS[incident.category] || ["First Aid"];

  const ranked = volunteersList.map(vol => {
    const distanceKm = calculateHaversineDistance(lat, lng, vol.location.lat, vol.location.lng);
    const etaMinutes = estimateETA(distanceKm, vol.vehicle.includes("Motorcycle") ? "motorcycle" : "ground");

    // Skill match fraction
    const volSkillSet = new Set(vol.skills.map(s => s.toLowerCase()));
    const matchedSkills = requiredSkills.filter(req => volSkillSet.has(req.toLowerCase()));
    const skillMatchScore = Math.round((matchedSkills.length / Math.max(1, requiredSkills.length)) * 100);

    // Proximity score (100 = 0km, 0 = 20km)
    const maxSearchRadius = vol.maxRadiusKm || 15.0;
    const proximityScore = Math.max(0, Math.round((1 - distanceKm / maxSearchRadius) * 100));

    // Composite Ranking Score
    // Weights: Proximity 45%, Skill Match 35%, Rating 15%, Missions 5%
    const ratingScore = ((vol.rating - 1) / 4) * 100;
    const compositeScore = Math.round(
      0.45 * proximityScore +
      0.35 * skillMatchScore +
      0.15 * ratingScore +
      0.05 * Math.min(100, vol.missionsCount * 2)
    );

    return {
      volunteer: vol,
      distanceKm,
      etaMinutes,
      skillMatchScore,
      matchedSkills,
      compositeScore,
      withinRadius: distanceKm <= maxSearchRadius
    };
  });

  // Sort by composite score descending; break ties by distance
  return ranked
    .filter(r => r.withinRadius && r.volunteer.status === "ACTIVE")
    .sort((a, b) => b.compositeScore - a.compositeScore || a.distanceKm - b.distanceKm);
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
  const { lat, lng } = incident.location;
  const neededTypes = CATEGORY_REQUIRED_RESOURCES[incident.category] || ["Ambulance"];

  const matches = resourcesList.map(res => {
    const distanceKm = calculateHaversineDistance(lat, lng, res.location.lat, res.location.lng);
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
    .filter(m => m.resource.status === "AVAILABLE")
    .sort((a, b) => (b.isNeededType ? 1 : 0) - (a.isNeededType ? 1 : 0) || a.distanceKm - b.distanceKm);
}
