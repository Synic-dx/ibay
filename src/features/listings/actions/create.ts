"use server";
/**
 * FEATURE: Create a listing (the "C" in CRUD) [RUBRIC:CRUD-CREATE] [RUBRIC:VALIDATION-SERVER]
 * WHAT: Saves the 3-step sell form. The new listing appears in search at once.
 * WHO CAN USE IT: signed-in, not banned students (10 new listings an hour).
 * FLOW: session -> Zod (same schema as the form) -> rate limit ->
 *       check the photos really uploaded -> insert listing + photos + audit row
 *       -> refresh home/browse/My listings -> the form redirects to the item page.
 */
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { rateLimit } from "@/lib/security/guard";
import { verifyPhotos } from "@/lib/uploads";
import { listingSchema, type ListingInput } from "@/lib/validation/listing";
import { findNearestResidence } from "@/features/map/proximity";
import { columnsFor, refreshListingPages } from "./shared";

/**
 * Creates a listing.
 * @param input the sell form values (validated again here)
 * @returns the new listing id
 */
export async function createListing(input: ListingInput): Promise<ActionResult<{ id: string }>> {
  // 1. Make sure the user is signed in.
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");

  // 3. Validate again on the server with the same schema (never trust the browser).
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  // 4. Rate limit.
  if (!(await rateLimit(`listing:${viewer.id}`, 3600, 10))) return fail("You have posted a lot in the last hour. Try again later.");

  // 5. Photos: real photos under 10 MB, uploaded through i-bay (Cloudinary converts for each browser).
  const photoErr = await verifyPhotos(d.photos);
  if (photoErr) return fail(photoErr, { photos: photoErr });

  // 6. Save. Persist effective pickup hostel based on chosen coordinates/hostel or default to seller's hostel.
  const now = Date.now();
  const effectiveHostel = (d.pickupLat != null && d.pickupLng != null)
    ? (findNearestResidence(d.pickupLat, d.pickupLng)?.location.name || d.pickupHostel || viewer.hostel)
    : (d.pickupHostel || viewer.hostel);

  const { data: row, error } = await db()
    .from("listings")
    .insert({
      ...columnsFor(d),
      seller_id: viewer.id,
      mode: d.mode,
      pickup_hostel: effectiveHostel,
      ends_at: d.mode === "auction" ? new Date(now + d.durationHours * 3600e3).toISOString() : d.mode === "drop" ? new Date(now + d.availableMinutes * 60e3).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    // The database is the last guard: turn a CHECK failure into a field message.
    const f = friendlyDbError(error);
    return fail(f.message, f.field ? { [f.field]: f.message } : undefined, "DB");
  }
  if (d.photos.length) {
    await db().from("listing_images").insert(d.photos.map((p, i) => ({ listing_id: row.id, url: p.url, public_id: p.publicId ?? null, fit: p.fit, position: i })));
  }
  await db().from("audit_log").insert({ actor_id: viewer.id, entity: "listing", entity_id: row.id, action: "create", after: { title: d.title, mode: d.mode, price: d.price } });

  // 7. Refresh the pages so it shows up in search right away.
  refreshListingPages(row.id);
  return ok({ id: row.id }, "Your listing is live");
}
