import { describe, it, expect } from "vitest";
import { listingSchema } from "@/lib/validation/listing";

describe("Listing Schema Coordinates & Handover Note", () => {
  it("validates listing input with optional coordinates and pickup note", () => {
    const input = {
      mode: "sell",
      title: "Scientific Calculator Casio fx-991EX",
      categoryId: "exam",
      price: 800,
      mrp: 1200,
      purchasedOn: "2024-05",
      condition: "Like new",
      pickupHostel: "SR 18",
      pickupLat: 22.6258,
      pickupLng: 75.7885,
      pickupNote: "Room 204, 2nd floor. Knock or text.",
      photos: [{ url: "https://example.com/photo.jpg", position: 0 }],
      rulesAgreed: true,
    };

    const res = listingSchema.safeParse(input);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.pickupLat).toBe(22.6258);
      expect(res.data.pickupLng).toBe(75.7885);
      expect(res.data.pickupNote).toBe("Room 204, 2nd floor. Knock or text.");
    }
  });

  it("rejects pickup note longer than 300 characters", () => {
    const input = {
      mode: "sell",
      title: "Scientific Calculator Casio fx-991EX",
      categoryId: "exam",
      price: 800,
      mrp: 1200,
      purchasedOn: "2024-05",
      condition: "Like new",
      pickupHostel: "SR 18",
      pickupNote: "A".repeat(301),
      photos: [{ url: "https://example.com/photo.jpg", position: 0 }],
      rulesAgreed: true,
    };

    const res = listingSchema.safeParse(input);
    expect(res.success).toBe(false);
  });
});
