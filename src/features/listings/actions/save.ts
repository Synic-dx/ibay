"use server";
/**
 * FEATURE: Save (heart) a listing
 * WHAT: Toggles a saved_items row. Saving also subscribes you to price drops
 *       (the listings_after_update trigger notifies savers).
 * WHO CAN USE IT: signed-in students.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/**
 * Hearts or un-hearts a listing.
 * @param listingId the listing
 * @returns { saved } the new state
 */
export async function toggleSave(listingId: string): Promise<ActionResult<{ saved: boolean }>> {
  // 1. Signed in?
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to save items.", undefined, "AUTH");
  // 2. Valid id?
  if (!z.uuid().safeParse(listingId).success) return fail("Listing not found.");
  // 3. Toggle.
  const { data: existing } = await db().from("saved_items").select("listing_id").eq("user_id", viewer.id).eq("listing_id", listingId).maybeSingle();
  if (existing) {
    await db().from("saved_items").delete().eq("user_id", viewer.id).eq("listing_id", listingId);
  } else {
    const { error } = await db().from("saved_items").insert({ user_id: viewer.id, listing_id: listingId });
    if (error) return fail("Couldn't save that. Try again.");
  }
  revalidatePath("/saved");
  return ok({ saved: !existing }, existing ? "Removed from saved" : "Saved. We will alert you if the price drops.");
}
