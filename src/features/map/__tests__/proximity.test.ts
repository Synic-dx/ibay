import { describe, it, expect } from "vitest";
import {
  getNearbyResidences,
  getResidenceCoordinates,
  findNearestResidence,
  calculateWalkingEffort,
  calculateDistanceMeters,
} from "@/features/map/proximity";

describe("Campus Residence Proximity", () => {
  it("resolves coordinates for known residences", () => {
    const coords = getResidenceCoordinates("SR 18");
    expect(coords).not.toBeNull();
    expect(coords?.lat).toBeCloseTo(22.6258, 3);
    expect(coords?.lng).toBeCloseTo(75.7885, 3);

    const dpmCoords = getResidenceCoordinates("DPM Residence");
    expect(dpmCoords).not.toBeNull();
    expect(dpmCoords?.lat).toBeCloseTo(22.6242, 3);
  });

  it("calculates distance and walking effort between SR 18 and DPM Residence", () => {
    const sr18 = getResidenceCoordinates("SR 18")!;
    const dpm = getResidenceCoordinates("DPM Residence")!;

    const dist = calculateDistanceMeters(sr18.lat, sr18.lng, dpm.lat, dpm.lng);
    expect(dist).toBeGreaterThan(150); // It's ~206m away, definitely > 55m hostel threshold
    expect(dist).toBeLessThan(300);

    const walking = calculateWalkingEffort("SR 18", dpm.lat, dpm.lng);
    expect(walking).not.toBeNull();
    expect(walking?.distanceMeters).toBeGreaterThan(150);
    expect(walking?.durationMinutes).toBeGreaterThanOrEqual(2);
  });

  it("finds nearest residence correctly for any coordinates", () => {
    // Exact DPM Residence coordinates
    const dpm = getResidenceCoordinates("DPM Residence")!;
    const nearest = findNearestResidence(dpm.lat, dpm.lng);
    expect(nearest).not.toBeNull();
    expect(nearest?.location.name).toBe("DPM Residence");
    expect(nearest?.distanceMeters).toBeLessThan(5);
  });

  it("finds adjacent residences within a cluster (~250m)", () => {
    // SR 18 is right next to SR 17, SR 20, SR 16A, SR 16B
    const nearby = getNearbyResidences("SR 18", 250);
    expect(nearby).toContain("SR 18"); // includes self
    expect(nearby).toContain("SR 17");
    expect(nearby).toContain("SR 20");
    // Should NOT include distant hostels on the other side of campus (e.g. SR 01 or SR 14)
    expect(nearby).not.toContain("SR 01");
    expect(nearby).not.toContain("SR 14");
  });

  it("handles an unknown or missing residence gracefully", () => {
    expect(getNearbyResidences("Somewhere else")).toEqual(["Somewhere else"]);
    expect(getNearbyResidences("")).toEqual([]);
  });
});
