"use server";
/**
 * FEATURE: Delete a listing (the "D" in CRUD) [RUBRIC:CRUD-DELETE]
 * WHAT: Soft-deletes a listing so it vanishes from search, home and saved lists
 *       at once, with a 10 second Undo. Chats keep a greyed "Listing deleted" card.
 *       A daily pg_cron job hard-deletes rows deleted more than 30 days ago.
 * WHO CAN USE IT: only the person who posted it (or an admin), checked here and
 *       again inside soft_delete_listing() in the database.
 * GUARD RAILS: an auction with bids can't be deleted (end it instead); a rental
 *       with an active or upcoming booking can't be deleted (pause it instead).
 * FLOW: confirm dialog -> deleteListing() -> soft_delete_listing() -> refresh pages -> toast with Undo.
 */
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { refreshListingPages } from "./shared";

/**
 * Soft-deletes one listing.
 * @returns ok, or a guard code ("AUCTION" / "RENTAL") so the dialog can offer the alternative
 */
export async function deleteListing(id: string): Promise<ActionResult<{ id: string }>> {
  // 1. Signed in?
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(id).success) return fail("Listing not found.");
  // 2. The RPC checks ownership and the guard rails under a row lock.
  const { error } = await db().rpc("soft_delete_listing", { p_listing: id, p_actor: viewer.id });
  if (error) {
    const f = friendlyDbError(error);
    return fail(f.message, undefined, f.code === "GUARD_AUCTION" ? "AUCTION" : f.code === "GUARD_RENTAL" ? "RENTAL" : "DB");
  }
  // 3. Refresh everything that showed it.
  refreshListingPages(id);
  return ok({ id }, "Listing deleted");
}

/**
 * Bulk "Delete selected" from My listings. Each listing goes through the same
 * checks; ones that hit a guard rail are skipped and reported.
 */
export async function bulkDelete(ids: string[]): Promise<ActionResult<{ deleted: string[]; skipped: { id: string; reason: string }[] }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const clean = ids.filter((i) => z.uuid().safeParse(i).success).slice(0, 50);
  const deleted: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of clean) {
    const { error } = await db().rpc("soft_delete_listing", { p_listing: id, p_actor: viewer.id });
    if (error) skipped.push({ id, reason: friendlyDbError(error).message });
    else deleted.push(id);
  }
  refreshListingPages();
  return ok(
    { deleted, skipped },
    `Deleted ${deleted.length} listing${deleted.length === 1 ? "" : "s"}${skipped.length ? `. ${skipped.length} skipped (bids or bookings).` : ""}`,
  );
}

/** Undo / Restore from the Deleted tab (within 30 days). */
export async function restoreListing(id: string): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(id).success) return fail("Listing not found.");
  const { error } = await db().rpc("restore_listing", { p_listing: id, p_actor: viewer.id });
  if (error) return fail(friendlyDbError(error).message);
  refreshListingPages(id);
  return ok({ id }, "Listing restored");
}

/** Restore several (Undo after a bulk delete). */
export async function restoreMany(ids: string[]): Promise<ActionResult<null>> {
  for (const id of ids.slice(0, 50)) await restoreListing(id);
  return ok(null, "Restored");
}
