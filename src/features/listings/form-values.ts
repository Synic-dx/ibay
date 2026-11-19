/**
 * FEATURE: Starting values for the sell / edit form
 */
import type { ListingDetail, Mode } from "./types";

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Empty form for a new listing (optionally starting on a deal type). */
export function emptyValues(mode: Mode = "sell") {
  return {
    mode,
    title: "",
    categoryId: mode === "drop" ? "food" : "",
    description: "",
    condition: "Good",
    photos: [],
    price: "",
    mrp: "",
    rentUnit: "day",
    deposit: "",
    buyNow: "",
    durationHours: 24,
    availableMinutes: 30,
    purchasedOn: thisMonth(),
    brand: "",
    model: "",
    size: "",
    specs: [],
    isBundle: false,
    bundleContents: "",
    sealStatus: "",
    expiresOn: "",
    pickupHostel: "",
    pickupLat: null,
    pickupLng: null,
    pickupNote: "",
    pickupSlots: [] as string[],
  } as Record<string, unknown> & { mode: Mode };
}

/** The edit form prefilled from a listing. Brand, Model and Size move out of the specs list. */
export function valuesFromListing(l: ListingDetail) {
  const pick = (k: string) => l.specs.find((s) => s.k === k)?.v ?? "";
  const minutes = l.endsAt ? Math.round((new Date(l.endsAt).getTime() - new Date(l.createdAt).getTime()) / 60e3) : 30;
  return {
    ...emptyValues(l.mode),
    title: l.title,
    categoryId: l.categoryId,
    description: l.description,
    condition: l.condition,
    photos: l.photos.map((p) => ({ url: p.url, publicId: p.publicId ?? null, fit: p.fit })),
    price: String(l.mode === "auction" ? (l.reservePrice ?? l.price) : l.price),
    mrp: l.mrp != null ? String(l.mrp) : "",
    rentUnit: l.rentUnit ?? "day",
    deposit: l.deposit != null ? String(l.deposit) : "",
    buyNow: l.buyNowPrice != null ? String(l.buyNowPrice) : "",
    availableMinutes: [15, 30, 60, 180].reduce((a, b) => (Math.abs(b - minutes) < Math.abs(a - minutes) ? b : a), 30),
    purchasedOn: l.purchasedOn ? l.purchasedOn.slice(0, 7) : thisMonth(),
    brand: l.brand ?? pick("Brand"),
    model: l.model ?? pick("Model"),
    size: l.size ?? pick("Size"),
    specs: l.specs.filter((s) => !["Brand", "Model", "Size"].includes(s.k)),
    isBundle: l.isBundle,
    bundleContents: l.bundleContents.join("\n"),
    sealStatus: l.sealStatus ?? "",
    expiresOn: l.expiresOn ?? "",
    pickupHostel: l.pickupHostel ?? "",
    pickupLat: l.pickupLat ?? null,
    pickupLng: l.pickupLng ?? null,
    pickupNote: l.pickupNote ?? "",
    pickupSlots: l.pickupSlots ?? [],
    updatedAt: l.updatedAt,
  };
}
