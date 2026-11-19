import { describe, it, expect } from "vitest";
import { columnsFor } from "../actions/shared";
import { emptyValues, valuesFromListing } from "../form-values";
import type { ListingData } from "@/lib/validation/listing";
import type { ListingDetail } from "../types";

describe("Listing Availability & Pickup Slots", () => {
  it("emptyValues contains empty pickupSlots array", () => {
    const val = emptyValues("sell");
    expect(val.pickupSlots).toEqual([]);
  });

  it("valuesFromListing extracts pickupSlots from listing detail", () => {
    const mockDetail = {
      id: "test-id",
      mode: "sell",
      title: "Test item",
      categoryId: "books",
      description: "Description",
      condition: "Good",
      price: 100,
      mrp: 200,
      photos: [],
      specs: [],
      pickupSlots: ["evening", "latenight"],
      isBundle: false,
      bundleContents: [],
      bundleItems: [],
      bids: [],
      bookings: [],
      views: 0,
      saves: 0,
      saved: false,
      seller: { id: "s1", name: "Alice", hostel: "SR 18", plume: 10, ratedDeals: 1, avatarUrl: null, avatarColor: "#000", responseNote: null },
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      pickupHostel: "SR 18",
      pickupLat: null,
      pickupLng: null,
      pickupNote: null,
      ticketInfo: [],
      bundleCount: 0,
      bidCount: 0,
      priceDropAmount: null,
      priceDroppedAt: null,
    } as unknown as ListingDetail;

    const val = valuesFromListing(mockDetail);
    expect(val.pickupSlots).toEqual(["evening", "latenight"]);
  });

  it("columnsFor maps pickupSlots to pickup_slots in database columns", () => {
    const data: ListingData = {
      mode: "sell",
      title: "Algorithms Book",
      categoryId: "books",
      price: 350,
      mrp: 600,
      condition: "Like new",
      description: "Good condition CLRS book",
      purchasedOn: "2024-01",
      pickupHostel: "SR 18",
      pickupSlots: ["morning", "evening"],
      photos: [],
      specs: [],
      isBundle: false,
      bundleContents: "",
    };

    const cols = columnsFor(data);
    expect(cols.pickup_slots).toEqual(["morning", "evening"]);
  });
});
