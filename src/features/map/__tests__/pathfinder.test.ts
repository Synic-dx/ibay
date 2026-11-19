import { describe, it, expect } from "vitest";
import { findCampusRoute, calculateDistanceMeters } from "@/features/map/pathfinder";

describe("Campus Pathfinder", () => {
  it("calculates haversine distance between two points accurately", () => {
    // Distance between SR 18 and SR 17 (~100m)
    const dist = calculateDistanceMeters(22.625808, 75.788543, 22.625636, 75.787843);
    expect(dist).toBeGreaterThan(60);
    expect(dist).toBeLessThan(120);
  });

  it("finds a route between two campus locations", () => {
    // From SR 18 to Academic Block
    const sr18: [number, number] = [75.788543, 22.625808]; // [lng, lat]
    const academic: [number, number] = [75.7958027, 22.6243007];

    const route = findCampusRoute(sr18, academic);
    expect(route).not.toBeNull();
    if (route) {
      expect(route.totalDistanceMeters).toBeGreaterThan(300);
      expect(route.stepCount).toBeGreaterThan(100);
      expect(route.estimatedDurationMinutes).toBeGreaterThan(2);
      expect(route.coordinates.length).toBeGreaterThan(2);
    }
  });

  it("handles identical origin and destination gracefully", () => {
    const point: [number, number] = [75.788543, 22.625808];
    const route = findCampusRoute(point, point);
    expect(route).not.toBeNull();
    if (route) {
      expect(route.totalDistanceMeters).toBe(0);
      expect(route.stepCount).toBe(0);
    }
  });
});
