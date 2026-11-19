import { describe, it, expect } from "vitest";
import { findEquidistantMeetingSpots, formatMeetHalfwayMessage } from "../midpoint";

describe("Chat Meet Halfway Coordination", () => {
  it("finds top central meeting spots between two residences", () => {
    // SR 18 (south-east campus) and SR 04 (north-west campus)
    const spots = findEquidistantMeetingSpots("SR 18", "SR 04", 3);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.length).toBeLessThanOrEqual(3);

    const first = spots[0];
    expect(first.location.name).toBeDefined();
    expect(first.distA).toBeGreaterThan(0);
    expect(first.distB).toBeGreaterThan(0);

    // Verify distance balance: both students should have roughly comparable walks
    const diff = Math.abs(first.distA - first.distB);
    expect(diff).toBeLessThan(350); // within reasonable walk difference
  });

  it("formats a polite chat suggestion with distances from both hostels", () => {
    const spots = findEquidistantMeetingSpots("SR 18", "SR 04", 1);
    expect(spots.length).toBeGreaterThan(0);

    const msg = formatMeetHalfwayMessage(spots[0], "SR 18", "SR 04");
    expect(msg).toContain("📍 How about we meet at");
    expect(msg).toContain(spots[0].location.name);
    expect(msg).toContain("SR 18");
    expect(msg).toContain("SR 04");
  });
});
