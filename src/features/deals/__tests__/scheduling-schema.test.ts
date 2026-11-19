import { describe, it, expect } from "vitest";
import { listingSchema } from "@/lib/validation/listing";

describe("Handover Scheduling Schema", () => {
  it("validates listing with optional pickupSlots", () => {
    const input = {
      mode: "sell",
      title: "Scientific Calculator Casio fx-991EX",
      categoryId: "exam",
      price: 800,
      mrp: 1200,
      purchasedOn: "2024-05",
      condition: "Like new",
      pickupHostel: "SR 18",
      pickupSlots: ["Evening (5 PM - 9 PM)", "Late Night (9 PM - 12 AM)"],
      photos: [{ url: "https://example.com/photo.jpg", position: 0 }],
      rulesAgreed: true,
    };

    const res = listingSchema.safeParse(input);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.pickupSlots).toEqual([
        "Evening (5 PM - 9 PM)",
        "Late Night (9 PM - 12 AM)",
      ]);
    }
  });

  it("defaults pickupSlots to an empty array if omitted", () => {
    const input = {
      mode: "sell",
      title: "Scientific Calculator Casio fx-991EX",
      categoryId: "exam",
      price: 800,
      mrp: 1200,
      purchasedOn: "2024-05",
      condition: "Like new",
      pickupHostel: "SR 18",
      photos: [{ url: "https://example.com/photo.jpg", position: 0 }],
      rulesAgreed: true,
    };

    const res = listingSchema.safeParse(input);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(Array.isArray(res.data.pickupSlots)).toBe(true);
    }
  });
});
