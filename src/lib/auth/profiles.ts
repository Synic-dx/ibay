/**
 * FEATURE: Profile lookup used by sign-in
 * WHAT: Finds or creates the profile row for a campus email.
 */
import "server-only";
import { db } from "@/lib/supabase/server";

const COLORS = ["#02505F", "#02637A", "#8A5A12", "#15702F", "#93443F", "#31494E", "#566F75", "#7A5610"];

/** "aarav.mehta@iimidr.ac.in" -> "Aarav Mehta". */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[._\d]+/g, " ").trim();
  const n = local.split(" ").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return n.length >= 2 ? n.slice(0, 60) : "Student";
}

/**
 * Whether an email already has an account (deleted accounts don't count).
 * @param email a campus email (already validated)
 */
export async function accountExists(email: string): Promise<boolean> {
  const { data, error } = await db().from("profiles").select("id").eq("email", email.trim().toLowerCase()).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Cookie that remembers "sign in" vs "create account" across the Google round trip. */
export const AUTH_INTENT_COOKIE = "ibay_auth_intent";

/**
 * Returns the profile for an email, creating it on first sign-in.
 * @param email a campus email (already validated)
 * @param name optional display name (sign-up form or Google)
 * @param avatarUrl optional photo (Google)
 * @returns the profile id and whether it was just created
 * @throws if the profile is banned or the database is unreachable
 */
export async function upsertProfileByEmail(email: string, name?: string, avatarUrl?: string): Promise<{ id: string; isNew: boolean }> {
  const e = email.trim().toLowerCase();
  const { data: existing, error } = await db().from("profiles").select("id, banned, deleted_at").eq("email", e).maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) {
    if (existing.banned) throw new Error("BANNED");
    if (existing.deleted_at) {
      await db().from("profiles").update({ deleted_at: null }).eq("id", existing.id);
    }
    return { id: existing.id, isNew: false };
  }
  const clean = (name ?? "").trim().replace(/[^\p{L}\p{M} .'-]/gu, "").slice(0, 60);
  const { data: created, error: insErr } = await db()
    .from("profiles")
    .insert({
      email: e,
      name: clean.length >= 2 ? clean : nameFromEmail(e),
      avatar_url: avatarUrl ?? null,
      avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return { id: created.id, isNew: true };
}
