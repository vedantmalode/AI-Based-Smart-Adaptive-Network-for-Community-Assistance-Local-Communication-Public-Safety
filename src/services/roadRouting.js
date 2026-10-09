const ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving';

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(meters))} m`;
}

function directionText(step) {
  const maneuver = step.maneuver || {};
  const road = step.name ? ` onto ${step.name}` : '';
  const modifier = String(maneuver.modifier || '').replaceAll('_', ' ');
  if (maneuver.type === 'depart') return `Head ${modifier || 'ahead'}${road}`;
  if (maneuver.type === 'arrive') return 'Arrive at the incident location';
  if (maneuver.type === 'roundabout' || maneuver.type === 'rotary') {
    return `At the roundabout, take exit ${maneuver.exit || 'shown on signs'}${road}`;
  }
  if (maneuver.type === 'turn' || maneuver.type === 'end of road') return `Turn ${modifier || 'ahead'}${road}`;
  if (maneuver.type === 'fork') return `Keep ${modifier || 'on the road'}${road}`;
  if (maneuver.type === 'merge') return `Merge ${modifier || 'ahead'}${road}`;
  if (maneuver.type === 'on ramp') return `Take the ramp ${modifier}${road}`;
  if (maneuver.type === 'off ramp') return `Take the exit ${modifier}${road}`;
  if (maneuver.type === 'new name') return `Continue${road}`;
  if (maneuver.type === 'continue') return `Continue ${modifier || 'ahead'}${road}`;
  return `${maneuver.type ? `${maneuver.type.replaceAll('_', ' ')} ` : 'Continue '}${modifier}${road}`.trim();
}

export async function fetchShortestRoadRoute(origin, destination, signal) {
  const coordinates = `${Number(origin.lng)},${Number(origin.lat)};${Number(destination.lng)},${Number(destination.lat)}`;
  const url = `${ROUTING_URL}/${coordinates}?alternatives=true&steps=true&overview=full&geometries=geojson`;
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Road routing service returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.code !== 'Ok' || !payload.routes?.length) throw new Error('No drivable road route was found for these coordinates.');

  // OSRM returns its fastest route first; select the shortest-distance option among alternatives.
  const route = [...payload.routes].sort((a, b) => a.distance - b.distance)[0];
  const steps = (route.legs || []).flatMap((leg) => leg.steps || []).map((step) => ({
    instruction: directionText(step),
    distanceMeters: Number(step.distance) || 0,
    distanceLabel: formatDistance(Number(step.distance) || 0),
    maneuverType: step.maneuver?.type || 'continue',
  })).filter((step) => step.distanceMeters > 0 || step.maneuverType === 'arrive');

  return {
    distanceMeters: route.distance,
    distanceKm: route.distance / 1000,
    durationSeconds: route.duration,
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
    coordinates: (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
    steps,
    source: 'Open Source Routing Machine · OpenStreetMap data',
  };
}
