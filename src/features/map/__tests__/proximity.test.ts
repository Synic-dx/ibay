import { describe, it, expect } from "vitest";
import { getNearbyResidences, getResidenceCoordinates } from "@/features/map/proximity";

describe("Campus Residence Proximity", () => {
  it("resolves coordinates for known residences", () => {
    const coords = getResidenceCoordinates("SR 18");
    expect(coords).not.toBeNull();
    expect(coords?.lat).toBeCloseTo(22.6258, 3);
    expect(coords?.lng).toBeCloseTo(75.7885, 3);
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

  it("handles unknown or Day scholar gracefully", () => {
    const nearby = getNearbyResidences("Day scholar");
    expect(nearby).toEqual(["Day scholar"]);
  });
});
