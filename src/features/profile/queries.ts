/**
 * FEATURE: Public profiles and reviews
 */
import "server-only";
import { db } from "@/lib/supabase/server";

export type PublicProfile = {
  id: string;
  name: string;
  hostel: string;
  plume: number;
  ratedDeals: number;
  avatarUrl: string | null;
  avatarColor: string;
  responseNote: string | null;
  since: string;
};

export type ReviewItem = { id: string; score: number; reason: string; tags: string[]; raterName: string; createdAt: string };

/** A person's public profile (null if deleted or banned). */
export async function getProfile(id: string): Promise<PublicProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: p } = await db().from("profiles").select("id,name,hostel,plume,rated_deals,avatar_url,avatar_color,response_note,created_at,banned,deleted_at").eq("id", id).maybeSingle();
  if (!p || p.banned || p.deleted_at) return null;
  return {
    id: p.id, name: p.name, hostel: p.hostel, plume: Number(p.plume), ratedDeals: p.rated_deals, avatarUrl: p.avatar_url, avatarColor: p.avatar_color, responseNote: p.response_note,
    since: new Date(p.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
  };
}

/** Reviews someone received, newest first. */
export async function reviewsFor(id: string, limit = 50): Promise<ReviewItem[]> {
  const { data } = await db().from("ratings").select("id,score,reason,tags,created_at,rater:profiles!ratings_rater_id_fkey(name)").eq("ratee_id", id).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, score: r.score, reason: r.reason, tags: r.tags, raterName: (r.rater as unknown as { name: string } | null)?.name ?? "Deleted user", createdAt: r.created_at }));
}
