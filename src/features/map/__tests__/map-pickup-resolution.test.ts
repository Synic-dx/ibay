import { describe, it, expect } from "vitest";
import { getEffectiveListingHostel } from "@/features/map/proximity";
import { mapCard } from "@/features/listings/queries";
import type { ListingCard } from "@/features/listings/types";

describe("Map Pickup Location Resolution", () => {
  const sellerFromSR18 = {
    id: "seller-123",
    name: "Ujjwal Harsh",
    hostel: "SR 18",
    plume: 50,
    ratedDeals: 5,
    avatarUrl: null,
    avatarColor: "#02505F",
    responseNote: null,
  };

  it("resolves effective hostel to DPM Residence when coordinates are at DPM Residence even if seller is from SR 18", () => {
    // Exact coordinates from the Vaseline Lip Balm listing
    const listing = {
      pickupHostel: "SR 18",
      pickupLat: 22.6242409,
      pickupLng: 75.7898725,
      seller: sellerFromSR18,
    };

    const effectiveHostel = getEffectiveListingHostel(listing);
    expect(effectiveHostel).toBe("DPM Residence");
  });

  it("resolves effective hostel to nearest residence for non-hostel landmark coordinates (e.g. Sports Complex -> SR 16B)", () => {
    // Sports Complex coordinates from campus-locations.json
    const listing = {
      pickupHostel: "SR 18",
      pickupLat: 22.628243,
      pickupLng: 75.788463,
      seller: sellerFromSR18,
    };

    const effectiveHostel = getEffectiveListingHostel(listing);
    expect(effectiveHostel).toBe("SR 16B");
  });

  it("falls back to pickupHostel or seller hostel when coordinates are not provided", () => {
    const listingWithoutCoords = {
      pickupHostel: "SR 04",
      pickupLat: null,
      pickupLng: null,
      seller: sellerFromSR18,
    };

    expect(getEffectiveListingHostel(listingWithoutCoords)).toBe("SR 04");

    const listingWithOnlySeller = {
      pickupHostel: null,
      pickupLat: null,
      pickupLng: null,
      seller: sellerFromSR18,
    };

    expect(getEffectiveListingHostel(listingWithOnlySeller)).toBe("SR 18");
  });

  it("mapCard automatically maps pickupHostel using effective coordinates", () => {
    const rawRow = {
      id: "item-123",
      title: "Vaseline Lip Balm",
      mode: "sell",
      category_id: "clothing",
      price: 79,
      mrp: 104,
      status: "active",
      pickup_hostel: "SR 18",
      pickup_lat: "22.6242409",
      pickup_lng: "75.7898725",
      seller: {
        id: "seller-123",
        name: "Ujjwal Harsh",
        hostel: "SR 18",
      },
      images: [],
    };

    const card: ListingCard = mapCard(rawRow);
    expect(card.pickupHostel).toBe("DPM Residence");
    expect(card.pickupLat).toBeCloseTo(22.6242409);
    expect(card.pickupLng).toBeCloseTo(75.7898725);
  });

  it("clusters listings by effective pickup hostel, not seller profile hostel", () => {
    const rawRow = {
      id: "item-123",
      title: "Vaseline Lip Balm",
      mode: "sell",
      category_id: "clothing",
      price: 79,
      mrp: 104,
      status: "active",
      pickup_hostel: "SR 18",
      pickup_lat: "22.6242409",
      pickup_lng: "75.7898725",
      seller: {
        id: "seller-123",
        name: "Ujjwal Harsh",
        hostel: "SR 18",
      },
      images: [],
    };

    const card = mapCard(rawRow);
    const listings = [card];

    const dpmListings = listings.filter(
      (l) => getEffectiveListingHostel(l).toLowerCase() === "dpm residence".toLowerCase()
    );
    const sr18Listings = listings.filter(
      (l) => getEffectiveListingHostel(l).toLowerCase() === "sr 18".toLowerCase()
    );

    expect(dpmListings).toHaveLength(1);
    expect(dpmListings[0].title).toBe("Vaseline Lip Balm");
    expect(sr18Listings).toHaveLength(0);
  });
});
