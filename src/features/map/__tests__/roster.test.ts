import { describe, it, expect } from "vitest";
import { HOSTELS, profileSchema } from "@/lib/validation/auth";

describe("IIM Indore Residence Roster", () => {
  it("includes all official campus residences (no day scholars at IIM Indore)", () => {
    // Must include SR residences
    expect(HOSTELS).toContain("SR 01");
    expect(HOSTELS).toContain("SR 16A");
    expect(HOSTELS).toContain("SR 16B");
    expect(HOSTELS).toContain("SR 18");
    expect(HOSTELS).toContain("SR 20");
    // Must include other student residences
    expect(HOSTELS).toContain("EPGP Hostel");
    expect(HOSTELS).toContain("DPM Residence");
    expect(HOSTELS).toContain("Married Residence 01");
    expect(HOSTELS).toContain("Executive Residence 01");
    expect(HOSTELS).not.toContain("Day scholar");
    // Must NOT contain old placeholder hostels
    expect(HOSTELS).not.toContain("Hostel 1");
    expect(HOSTELS).not.toContain("Hostel 6");
  });

  it("validates profile schema with a real campus residence", () => {
    const valid = profileSchema.safeParse({
      name: "Ujjwal Harsh",
      hostel: "SR 18",
    });
    expect(valid.success).toBe(true);

    const invalid = profileSchema.safeParse({
      name: "Ujjwal Harsh",
      hostel: "Hostel 1",
    });
    expect(invalid.success).toBe(false);
  });
});
