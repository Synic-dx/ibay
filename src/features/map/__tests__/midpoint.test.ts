import { describe, it, expect } from "vitest";
import { getEquidistantLandmark } from "@/features/map/midpoint";

describe("Campus Midpoint & Meeting Suggestions", () => {
  it("suggests a neutral, central landmark between two distant hostels", () => {
    // SR 18 (western side) and SR 01 (eastern/academic side)
    const landmark = getEquidistantLandmark("SR 18", "SR 01");
    expect(landmark).not.toBeNull();
    // Central landmarks: Nescafe, SAC/Sports Complex, Pi Shop, Mess, Library, Admin Block
    expect(["Nescafe", "The Pi Shop", "Learning Center", "Sports Complex", "Mess 1", "Juicilicious Cafe", "Administrative Block"]).toContain(landmark?.name);
  });

  it("suggests the hostel itself if both students are in the same residence", () => {
    const landmark = getEquidistantLandmark("SR 18", "SR 18");
    expect(landmark).not.toBeNull();
    expect(landmark?.name).toBe("SR 18");
  });
});
