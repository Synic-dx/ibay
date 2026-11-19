import campusLocations from "./data/campus-locations.json";
import type { CampusLocation } from "./types";

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const locations: CampusLocation[] = campusLocations as CampusLocation[];
const residenceLocations = locations.filter(
  (l) => l.category === "Hostel" || l.name.startsWith("SR ")
);

export function getResidenceCoordinates(residenceName: string): { lat: number; lng: number } | null {
  if (!residenceName) return null;
  const target = residenceName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const found = residenceLocations.find(
    (r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, "") === target
  );
  return found ? { lat: found.lat, lng: found.lng } : null;
}

export function getNearbyResidences(residenceName: string, radiusMeters = 250): string[] {
  if (!residenceName) return [];

  const origin = getResidenceCoordinates(residenceName);
  if (!origin) return [residenceName];

  const nearby: string[] = [];
  for (const r of residenceLocations) {
    const dist = calculateDistanceMeters(origin.lat, origin.lng, r.lat, r.lng);
    if (dist <= radiusMeters) {
      nearby.push(r.name);
    }
  }

  if (!nearby.includes(residenceName)) {
    nearby.push(residenceName);
  }

  return nearby;
}

export function findNearestLandmark(
  lat: number,
  lng: number
): { location: CampusLocation; distanceMeters: number } | null {
  if (!locations.length) return null;
  let nearest: CampusLocation | null = null;
  let minDistance = Infinity;

  for (const loc of locations) {
    const dist = calculateDistanceMeters(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  }

  return nearest ? { location: nearest, distanceMeters: minDistance } : null;
}

export function findNearestResidence(
  lat: number,
  lng: number
): { location: CampusLocation; distanceMeters: number } | null {
  if (!residenceLocations.length) return null;
  let nearest: CampusLocation | null = null;
  let minDistance = Infinity;

  for (const loc of residenceLocations) {
    const dist = calculateDistanceMeters(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  }

  return nearest ? { location: nearest, distanceMeters: minDistance } : null;
}

export interface WalkingEffort {
  distanceMeters: number;
  steps: number;
  durationMinutes: number;
}

export function calculateWalkingEffort(
  viewerHostel: string,
  destLat: number,
  destLng: number
): WalkingEffort | null {
  if (!viewerHostel) return null;
  const origin = getResidenceCoordinates(viewerHostel);
  if (!origin) return null;
  const dist = calculateDistanceMeters(origin.lat, origin.lng, destLat, destLng);
  const steps = Math.round(dist / 0.78);
  const durationMinutes = Math.max(1, Math.round(dist / 75));
  return {
    distanceMeters: dist,
    steps,
    durationMinutes,
  };
}


