import { describe, it, expect } from "vitest";
import { canSeeDrop } from "@/features/listings/queries";
import type { ListingCard } from "@/features/listings/types";
import type { Viewer } from "@/lib/auth/session";

describe("Food Drops Proximity Visibility", () => {
  const baseDrop: Partial<ListingCard> = {
    mode: "drop",
    pickupHostel: "SR 18",
  };

  it("allows viewer in the exact same hostel to see the drop", () => {
    const viewer: Partial<Viewer> = {
      id: "user-1",
      hostel: "SR 18",
    };
    expect(canSeeDrop(baseDrop as ListingCard, viewer as Viewer)).toBe(true);
  });

  it("allows viewer in an adjacent hostel within 250m to see the drop", () => {
    // SR 17 and SR 18 are adjacent student residences (distance < 200m)
    const viewer: Partial<Viewer> = {
      id: "user-2",
      hostel: "SR 17",
    };
    expect(canSeeDrop(baseDrop as ListingCard, viewer as Viewer)).toBe(true);
  });

  it("blocks viewer in a distant hostel (>250m away)", () => {
    // SR 01 is on the far north side of campus, SR 18 is south-east (>500m)
    const viewer: Partial<Viewer> = {
      id: "user-3",
      hostel: "SR 01",
    };
    expect(canSeeDrop(baseDrop as ListingCard, viewer as Viewer)).toBe(false);
  });

  it("blocks unauthenticated viewers for food drops", () => {
    expect(canSeeDrop(baseDrop as ListingCard, null)).toBe(false);
  });

  it("allows anyone to see regular sell/rent listings regardless of hostel", () => {
    const item: Partial<ListingCard> = {
      mode: "sell",
      pickupHostel: "SR 18",
    };
    const viewer: Partial<Viewer> = {
      id: "user-3",
      hostel: "SR 01",
    };
    expect(canSeeDrop(item as ListingCard, viewer as Viewer)).toBe(true);
    expect(canSeeDrop(item as ListingCard, null)).toBe(true);
  });
});
