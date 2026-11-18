import campusLocations from "./data/campus-locations.json";
import { calculateDistanceMeters, getResidenceCoordinates } from "./proximity";
import type { CampusLocation } from "./types";

const locations: CampusLocation[] = campusLocations as CampusLocation[];

const NEUTRAL_CATEGORIES = new Set([
  "Cafe & Eatery",
  "Library",
  "Mess & Dining",
  "Sports & Gym",
  "General Store",
  "Administrative",
]);

export function getEquidistantLandmark(resA: string, resB: string): CampusLocation | null {
  if (resA === resB) {
    const same = locations.find(
      (l) => l.name.toLowerCase().trim() === resA.toLowerCase().trim()
    );
    if (same) return same;
  }

  const coordA = getResidenceCoordinates(resA) || { lat: 22.6245, lng: 75.7958 }; // Fallback to Main Gate / Entrance
  const coordB = getResidenceCoordinates(resB) || { lat: 22.6245, lng: 75.7958 };

  const midLat = (coordA.lat + coordB.lat) / 2;
  const midLng = (coordA.lng + coordB.lng) / 2;

  // Filter candidate neutral spots
  const candidates = locations.filter(
    (l) => NEUTRAL_CATEGORIES.has(l.category) && !l.name.startsWith("__")
  );

  let bestLandmark: CampusLocation | null = null;
  let minDiff = Infinity;

  for (const cand of candidates) {
    const distFromA = calculateDistanceMeters(coordA.lat, coordA.lng, cand.lat, cand.lng);
    const distFromB = calculateDistanceMeters(coordB.lat, coordB.lng, cand.lat, cand.lng);
    const distFromMid = calculateDistanceMeters(midLat, midLng, cand.lat, cand.lng);

    // Prefer social spots (cafes, stores, library, sports) over purely administrative buildings
    const categoryFactor = cand.category === "Cafe & Eatery" || cand.category === "General Store" ? 0.7 : 1.0;

    // Score combines balance (|distA - distB|) and total distance from the midpoint
    const score = (Math.abs(distFromA - distFromB) * 1.5 + distFromMid) * categoryFactor;
    if (score < minDiff) {
      minDiff = score;
      bestLandmark = cand;
    }
  }

  return bestLandmark;
}
