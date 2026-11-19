/**
 * FEATURE: Helpers shared by the listing Server Actions (server-only)
 * WHAT: Turns validated form data into database columns, and refreshes the
 *       pages that show listings after a change.
 */
import "server-only";
import { revalidatePath } from "next/cache";
import { NO_VALUE_CHECK, type ListingData } from "@/lib/validation/listing";

/** "2025-03" -> "2025-03-01". */
const monthToDate = (m?: string) => (m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : null);

/** Words from the title used as search tags (plus the brand). */
export function tagsFor(d: ListingData): string[] {
  const words = d.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const supplement = /protein|whey|creatine|pre.?workout|supplement|multivitamin|bcaa|gainer/i.test(d.title);
  return [...new Set([...words, ...(d.brand ? [d.brand.toLowerCase()] : []), ...(supplement ? ["supplement"] : [])])].slice(0, 20);
}

/**
 * Database columns for a listing (used for create and, minus locked fields, for edit).
 * @param d validated listing form data
 */
export function columnsFor(d: ListingData) {
  const valueCheck = d.mode !== "drop" && !NO_VALUE_CHECK.includes(d.categoryId);
  const specs = [...(d.brand ? [{ k: "Brand", v: d.brand }] : []), ...(d.model ? [{ k: "Model", v: d.model }] : []), ...(d.size ? [{ k: "Size", v: d.size }] : []), ...d.specs].slice(0, 12);
  return {
    title: d.title,
    description: d.description,
    category_id: d.mode === "drop" ? "food" : d.categoryId,
    condition: d.condition,
    price: d.price,
    mrp: d.mode === "drop" ? null : valueCheck || (d.mrp !== undefined && !Number.isNaN(Number(d.mrp))) ? Number(d.mrp) : null,
    rent_unit: d.mode === "rent" ? d.rentUnit : null,
    deposit: d.mode === "rent" ? d.deposit : null,
    reserve_price: d.mode === "auction" ? d.price : null,
    buy_now_price: d.mode === "auction" ? (d.buyNow ?? null) : null,
    brand: d.brand || null,
    model: d.model || null,
    size: d.size || null,
    specs: specs.map((s) => [s.k, s.v]),
    purchased_on: d.mode !== "drop" ? monthToDate(d.purchasedOn) : null,
    seal_status: d.sealStatus || null,
    expires_on: d.expiresOn || null,
    is_bundle: d.isBundle,
    bundle_contents: d.isBundle ? d.bundleContents.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20) : [],
    pickup_lat: d.pickupLat ?? null,
    pickup_lng: d.pickupLng ?? null,
    pickup_note: d.pickupNote ?? null,
    pickup_slots: d.pickupSlots || [],
    tags: tagsFor(d),
  };
}

/** Refreshes every page that lists listings (home, browse, My listings, the item). */
export function refreshListingPages(id?: string) {
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/my-listings");
  revalidatePath("/saved");
  if (id) {
    revalidatePath(`/item/${id}`);
    revalidatePath(`/listings/${id}/edit`);
  }
}
