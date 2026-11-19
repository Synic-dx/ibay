/**
 * FEATURE: Listing shapes used by the UI
 * WHAT: Plain serialisable objects (safe to pass from Server to Client
 *       Components). Database rows are mapped into these in queries.ts.
 */
import type { RentUnit } from "@/lib/format";

export type Mode = "sell" | "rent" | "auction" | "drop";
export type ListingStatus = "active" | "paused" | "sold" | "claimed" | "closed" | "expired" | "hidden" | "deleted";

export type SellerLite = {
  id: string;
  name: string;
  hostel: string;
  plume: number;
  ratedDeals: number;
  avatarUrl: string | null;
  avatarColor: string;
  responseNote: string | null;
};

export type ListingPhoto = { url: string; fit: "contain" | "cover"; publicId?: string | null };

/** Everything a product card (and most lists) needs. */
export type ListingCard = {
  id: string;
  title: string;
  mode: Mode;
  categoryId: string;
  price: number;
  mrp: number | null;
  rentUnit: RentUnit | null;
  deposit: number | null;
  reservePrice: number | null;
  buyNowPrice: number | null;
  endsAt: string | null;
  status: ListingStatus;
  purchasedOn: string | null;
  condition: string;
  photo: ListingPhoto | null;
  ticketInfo: string[];
  isBundle: boolean;
  bundleCount: number;
  bidCount: number;
  priceDropAmount: number | null;
  priceDroppedAt: string | null;
  pickupHostel: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupSlots?: string[];
  seller: SellerLite;
  views: number;
  saves: number;
  saved: boolean;
  brand: string | null;
  model: string | null;
  size: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Hourly rentals only: "Today 9 PM" style next free slot. */
  nextFree?: string | null;
};

/** Item page: the card plus details, photos, specs, bundles, bookings and bids. */
export type ListingDetail = ListingCard & {
  description: string;
  pickupNote?: string | null;
  photos: ListingPhoto[];
  specs: { k: string; v: string }[];
  sealStatus: string | null;
  expiresOn: string | null;
  bundleContents: string[];
  bundleItems: ListingCard[];
  partOfBundle: ListingCard | null;
  bids: { id: string; amount: number; createdAt: string; bidderId: string; bidderName: string }[];
  /** Booked periods (ISO start/end) for rentals in the next 14 days. */
  bookings: { start: string; end: string }[];
  statusBeforeDelete: ListingStatus | null;
};
