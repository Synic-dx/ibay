/**
 * FEATURE: Data access layer for "who is signed in" [RUBRIC:AUTH]
 * WHAT: getViewer() reads the Auth.js session and loads the profile;
 *       requireViewer() is used by protected pages and every Server Action.
 * WHY: one function decides who the user is, so no page or action trusts an id
 *      sent from the browser.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, dbReady } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string;
  name: string;
  hostel: string;
  room: string | null;
  whatsapp: string | null;
  showWhatsapp: boolean;
  avatarUrl: string | null;
  avatarColor: string;
  plume: number;
  ratedDeals: number;
  role: "user" | "admin";
  onboarded: boolean;
  notifyPrefs: Record<string, boolean>;
  createdAt: string;
};

/**
 * The signed-in student, or null for guests. Cached per request.
 * Banned or deleted profiles count as signed out.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!dbReady()) return null;
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const { data } = await db()
    .from("profiles")
    .select("id,email,name,hostel,room,whatsapp,show_whatsapp,avatar_url,avatar_color,plume,rated_deals,role,onboarded,notify_prefs,banned,deleted_at,created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.banned || data.deleted_at) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    hostel: data.hostel,
    room: data.room,
    whatsapp: data.whatsapp,
    showWhatsapp: data.show_whatsapp,
    avatarUrl: data.avatar_url,
    avatarColor: data.avatar_color,
    plume: Number(data.plume),
    ratedDeals: data.rated_deals,
    role: data.role,
    onboarded: data.onboarded,
    notifyPrefs: data.notify_prefs ?? {},
    createdAt: data.created_at,
  };
});

/**
 * The signed-in student; sends guests to /login and back afterwards.
 * @param next where to return after signing in
 */
export async function requireViewer(next = "/"): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v;
}
