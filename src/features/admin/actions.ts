"use server";
/**
 * FEATURE: Safety: reports and admin moderation
 * WHAT: report() lets anyone signed in report a listing, message or person. Admin actions: hide / unhide,
 *       delete / restore any listing, ban / unban or delete a person, and resolve a report.
 *       Admin actions check role = 'admin' here, and the database functions check it again.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/security/guard";
import { reportSchema } from "@/lib/validation/market";
import { friendlyDbError } from "@/lib/db-errors";
import { refreshListingPages } from "@/features/listings/actions/shared";

/** File a report (Zod, then a rate limit). */
export async function report(input: z.input<typeof reportSchema>): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to report.", undefined, "AUTH");
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await rateLimit(`report:${viewer.id}`, 3600, 10))) return fail("Too many reports in an hour.");
  const v = parsed.data;
  const { error } = await db().from("reports").insert({ reporter_id: viewer.id, listing_id: v.listingId ?? null, reported_user_id: v.userId ?? null, message_id: v.messageId ?? null, reason: v.reason, details: v.details });
  if (error) return fail("Couldn't send the report. Try again.");
  revalidatePath("/admin");
  return ok(null, "Thanks. The i-bay team will review it.");
}

async function requireAdmin() {
  const v = await getViewer();
  return v && v.role === "admin" ? v : null;
}

/** Hide (or unhide) a listing from everyone. */
export async function setListingHidden(listingId: string, hidden: boolean): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only.");
  if (!z.uuid().safeParse(listingId).success) return fail("Listing not found.");
  await db().from("listings").update({ status: hidden ? "hidden" : "active" }).eq("id", listingId);
  await db().from("audit_log").insert({ actor_id: admin.id, entity: "listing", entity_id: listingId, action: "update", after: { status: hidden ? "hidden" : "active", by: "admin" } });
  revalidatePath("/admin");
  revalidatePath("/");
  return ok(null, hidden ? "Listing hidden" : "Listing visible again");
}

/** Ban (or unban) a person. Banned people are signed out and their listings disappear. */
export async function setBanned(userId: string, banned: boolean): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only.");
  if (!z.uuid().safeParse(userId).success || userId === admin.id) return fail("You can't ban that account.");
  await db().from("profiles").update({ banned }).eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/");
  return ok(null, banned ? "User banned" : "User unbanned");
}

/**
 * Delete any listing (it can be restored from the admin Listings tab).
 * Unlike owners, admins can also remove auctions with bids and rentals with bookings.
 */
export async function adminDeleteListing(listingId: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only.");
  if (!z.uuid().safeParse(listingId).success) return fail("Listing not found.");
  const { error } = await db().rpc("soft_delete_listing", { p_listing: listingId, p_actor: admin.id });
  if (error) return fail(friendlyDbError(error).message);
  refreshListingPages(listingId);
  revalidatePath("/admin");
  return ok(null, "Listing deleted");
}

/** Bring back a deleted listing. */
export async function adminRestoreListing(listingId: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only.");
  if (!z.uuid().safeParse(listingId).success) return fail("Listing not found.");
  const { error } = await db().rpc("restore_listing", { p_listing: listingId, p_actor: admin.id });
  if (error) return fail(friendlyDbError(error).message);
  refreshListingPages(listingId);
  revalidatePath("/admin");
  return ok(null, "Listing restored");
}

/**
 * Permanently delete a person's account with their listings, bids, deals and chats.
 * Admin accounts (including your own) can't be deleted. This can't be undone;
 * to stop someone without losing data, ban them instead.
 */
export async function adminDeleteUser(userId: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only.");
  if (!z.uuid().safeParse(userId).success) return fail("Account not found.");
  const { data, error } = await db().rpc("admin_delete_user", { p_user: userId, p_actor: admin.id });
  if (error) return fail(friendlyDbError(error).message);
  revalidatePath("/", "layout");
  const n = (data as { listings?: number } | null)?.listings ?? 0;
  return ok(null, `Account deleted${n ? ` with ${n} listing${n === 1 ? "" : "s"}` : ""}`);
}

/** Mark a report as actioned or dismissed. */
export async function resolveReport(reportId: string, status: "actioned" | "dismissed"): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only.");
  await db().from("reports").update({ status, handled_by: admin.id }).eq("id", reportId);
  revalidatePath("/admin");
  return ok(null, "Report updated");
}
