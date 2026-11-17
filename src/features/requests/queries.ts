/**
 * FEATURE: Reading requests ("I am looking for a...") [RUBRIC:CRUD-READ]
 * WHAT: The requests board (sort by soonest needed / newest / most needed),
 *       one request with its replies, and the home-page rail.
 */
import "server-only";
import { db } from "@/lib/supabase/server";

export type RequestItem = {
  id: string;
  text: string;
  categoryId: string;
  budget: string;
  neededBy: string | null;
  status: "open" | "found" | "deleted";
  votes: number;
  voted: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; hostel: string; avatarColor: string; avatarUrl: string | null; plume: number; ratedDeals: number };
  replyCount: number;
};

export type ReplyItem = {
  id: string;
  text: string;
  priceText: string;
  imageUrl: string | null;
  accepted: boolean;
  createdAt: string;
  author: { id: string; name: string; plume: number; ratedDeals: number; avatarColor: string; avatarUrl: string | null };
};

const SELECT =
  "id,text,category_id,budget,needed_by,status,votes,created_at,updated_at,deleted_at," +
  "author:profiles!requests_author_id_fkey(id,name,hostel,avatar_color,avatar_url,plume,rated_deals),replies:request_replies(count)";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST row with joins */
function map(r: any, voted: Set<string>): RequestItem {
  return {
    id: r.id,
    text: r.text,
    categoryId: r.category_id,
    budget: r.budget,
    neededBy: r.needed_by,
    status: r.status,
    votes: r.votes,
    voted: voted.has(r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: {
      id: r.author?.id, name: r.author?.name ?? "Student", hostel: r.author?.hostel ?? "", avatarColor: r.author?.avatar_color ?? "#02505F",
      avatarUrl: r.author?.avatar_url ?? null, plume: Number(r.author?.plume ?? 0), ratedDeals: r.author?.rated_deals ?? 0,
    },
    replyCount: r.replies?.[0]?.count ?? 0,
  };
}

async function votedSet(viewerId?: string): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const { data } = await db().from("request_votes").select("request_id").eq("user_id", viewerId);
  return new Set((data ?? []).map((v) => v.request_id as string));
}

/**
 * Open requests, sorted.
 * @param sort "urgent" (soonest needed first), "new" or "top" (most upvotes)
 */
export async function listRequests(sort: string, viewerId?: string, limit = 50): Promise<RequestItem[]> {
  let q = db().from("requests").select(SELECT).is("deleted_at", null).eq("status", "open").limit(limit);
  if (sort === "new") q = q.order("created_at", { ascending: false });
  else if (sort === "top") q = q.order("votes", { ascending: false }).order("created_at", { ascending: false });
  else q = q.order("needed_by", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  const [{ data }, voted] = await Promise.all([q, votedSet(viewerId)]);
  return (data ?? []).map((r) => map(r, voted));
}

/** My own requests (any status except deleted) for the owner view. */
export async function myRequests(viewerId: string): Promise<RequestItem[]> {
  const [{ data }, voted] = await Promise.all([
    db().from("requests").select(SELECT).eq("author_id", viewerId).is("deleted_at", null).order("created_at", { ascending: false }),
    votedSet(viewerId),
  ]);
  return (data ?? []).map((r) => map(r, voted));
}

/** One request with its live replies. Deleted requests are only visible to their author. */
export async function getRequest(id: string, viewerId?: string): Promise<{ request: RequestItem; replies: ReplyItem[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data: r }, voted] = await Promise.all([db().from("requests").select(SELECT).eq("id", id).maybeSingle(), votedSet(viewerId)]);
  if (!r) return null;
  const row = r as unknown as { deleted_at: string | null; author?: { id: string } };
  if (row.deleted_at && row.author?.id !== viewerId) return null;
  const { data: reps } = await db()
    .from("request_replies")
    .select("id,text,price_text,image_url,accepted,created_at,author:profiles!request_replies_author_id_fkey(id,name,plume,rated_deals,avatar_color,avatar_url)")
    .eq("request_id", id)
    .is("deleted_at", null)
    .order("created_at");
  return {
    request: map(r, voted),
    replies: (reps ?? []).map((x) => {
      const a = x.author as unknown as { id: string; name: string; plume: number; rated_deals: number; avatar_color: string; avatar_url: string | null };
      return {
        id: x.id, text: x.text, priceText: x.price_text, imageUrl: x.image_url, accepted: x.accepted, createdAt: x.created_at,
        author: { id: a.id, name: a.name, plume: Number(a.plume), ratedDeals: a.rated_deals, avatarColor: a.avatar_color, avatarUrl: a.avatar_url },
      };
    }),
  };
}
