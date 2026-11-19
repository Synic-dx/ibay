"use server";
/**
 * FEATURE: Profile read/update and account deletion
 * WHAT: Update name, hostel, room, WhatsApp; change photo; delete my account
 *       (anonymises reviews instead of breaking them); mark notifications read.
 * WHO CAN USE IT: only the signed-in student, on their own row.
 * FLOW: session -> Zod (same schema as the form) -> update -> refresh pages.
 */
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { deleteAccountSchema, HOSTELS, profileSchema, type ProfileInput } from "@/lib/validation/auth";

/**
 * Saves the profile form (also used by first-login onboarding).
 * @param input name, hostel, room, WhatsApp, show WhatsApp
 */
export async function updateProfile(input: ProfileInput): Promise<ActionResult<null>> {
  // 1. Signed in?
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  // 2. Same schema as the browser, run again on the server.
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  // 3. Save (the CHECK constraints repeat these rules in Postgres).
  const { error } = await db()
    .from("profiles")
    .update({ name: v.name, hostel: v.hostel, room: v.room ?? null, whatsapp: v.whatsapp ?? null, show_whatsapp: v.showWhatsapp, onboarded: true })
    .eq("id", viewer.id);
  if (error) {
    const f = friendlyDbError(error);
    return fail(f.message, f.field ? { [f.field]: f.message } : undefined);
  }
  // 4. Your listings are picked up from your new hostel (only for listings without custom coordinates).
  if (v.hostel !== viewer.hostel) {
    await db()
      .from("listings")
      .update({ pickup_hostel: v.hostel })
      .eq("seller_id", viewer.id)
      .in("status", ["active", "paused"])
      .neq("mode", "drop")
      .is("pickup_lat", null)
      .is("pickup_lng", null);
  }
  revalidatePath("/", "layout");
  return ok(null, "Saved");
}

/** Quick hostel change from the header "Meet at" button. */
export async function setHostel(hostel: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!(HOSTELS as readonly string[]).includes(hostel)) return fail("Pick a hostel from the list.");
  await db().from("profiles").update({ hostel }).eq("id", viewer.id);
  await db()
    .from("listings")
    .update({ pickup_hostel: hostel })
    .eq("seller_id", viewer.id)
    .in("status", ["active", "paused"])
    .neq("mode", "drop")
    .is("pickup_lat", null)
    .is("pickup_lng", null);
  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * First-login onboarding: hostel, room and optional WhatsApp (name stays as it is).
 */
export async function completeOnboarding(input: { hostel: string; room?: string; whatsapp?: string }): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const parsed = profileSchema.pick({ hostel: true, room: true, whatsapp: true }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  await db().from("profiles").update({ hostel: v.hostel, room: v.room ?? null, whatsapp: v.whatsapp ?? null, onboarded: true }).eq("id", viewer.id);
  revalidatePath("/", "layout");
  return ok(null);
}

/** Marks onboarding as done without changing anything ("Skip for now"). */
export async function skipOnboarding(): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  await db().from("profiles").update({ onboarded: true }).eq("id", viewer.id);
  return ok(null);
}

/** Saves a new profile photo URL (uploaded to Cloudinary or storage first). */
export async function setAvatar(url: string, publicId: string | null): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  if (!/^(https:\/\/|\/)/.test(url)) return fail("That photo didn't upload properly.");
  await db().from("profiles").update({ avatar_url: url, avatar_public_id: publicId }).eq("id", viewer.id);
  revalidatePath("/", "layout");
  return ok(null, "Photo updated");
}

/** Turns notification emails on or off per kind. */
export async function setNotifyPref(key: string, on: boolean): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const allowed = ["email", "outbid", "offers", "requests", "drops", "price_drops", "returns", "ratings"];
  if (!allowed.includes(key)) return fail("Unknown setting.");
  await db().from("profiles").update({ notify_prefs: { ...viewer.notifyPrefs, [key]: on } }).eq("id", viewer.id);
  revalidatePath("/account");
  return ok(null);
}

/** Marks all notifications as read (opening the bell page). */
export async function markNotificationsRead(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).is("read_at", null);
}

/**
 * Deletes my account: listings are soft deleted, reviews stay but show "Deleted user",
 * and the profile is anonymised (so ratings and deals don't break).
 * @param input { confirm: "DELETE" }
 */
export async function deleteMyAccount(input: { confirm: string }): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const now = new Date().toISOString();
  // 1. Hide every listing (soft delete).
  await db().from("listings").update({ status: "deleted", deleted_at: now }).eq("seller_id", viewer.id).neq("status", "deleted");
  // 2. Anonymise the profile: keep the row so reviews and deals still make sense.
  await db()
    .from("profiles")
    .update({
      name: "Deleted user",
      email: `deleted-${viewer.id.slice(0, 8)}@iimidr.ac.in`,
      room: null,
      whatsapp: null,
      avatar_url: null,
      deleted_at: now,
    })
    .eq("id", viewer.id);
  await signOut({ redirect: false });
  revalidatePath("/", "layout");
  return ok(null, "Your account was deleted.");
}
