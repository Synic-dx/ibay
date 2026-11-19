import { describe, it, expect } from "vitest";
import { calculateWalkingEffort } from "../proximity";

describe("Handover Privacy & Walking Effort", () => {
  it("calculates walking effort between a hostel and pickup coordinates", () => {
    // SR 18 coordinates: lat ~22.6258, lng ~75.7885
    // Near Nescafe / Sports Complex: lat ~22.6272, lng ~75.7892
    const effort = calculateWalkingEffort("SR 18", 22.6272, 75.7892);
    expect(effort).not.toBeNull();
    if (effort) {
      expect(effort.distanceMeters).toBeGreaterThan(50);
      expect(effort.distanceMeters).toBeLessThan(1000);
      expect(effort.steps).toBeGreaterThan(40);
      expect(effort.durationMinutes).toBeGreaterThanOrEqual(1);
    }
  });

  it("handles an unknown or missing origin gracefully", () => {
    const effort = calculateWalkingEffort("Somewhere else", 22.6272, 75.7892);
    expect(effort).toBeNull();
  });
});
