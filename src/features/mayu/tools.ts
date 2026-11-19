/**
 * FEATURE: Mayu's tools (read-only) [RUBRIC:EXTRA]
 * WHAT: The only things the model can do: search listings, open one listing,
 *       list open requests, explain Plume and read your own stats. Nothing can
 *       write. Cards on screen are built from these tool results, never from
 *       model text, so Mayu can't invent a listing.
 */
import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { dbReady } from "@/lib/supabase/server";
import { browseListings, getListingDetail } from "@/features/listings/queries";
import { listRequests } from "@/features/requests/queries";
import { listDeals } from "@/features/deals/queries";
import { ageMonths, ageText, unitShort } from "@/lib/format";
import { trustLevel } from "@/lib/plume";
import type { Viewer } from "@/lib/auth/session";
import type { ListingCard } from "@/features/listings/types";

/** What the model sees for each listing (small and factual). */
export const brief = (l: ListingCard) => ({
  id: l.id,
  title: l.title,
  mode: l.mode,
  price: l.price,
  unit: l.mode === "rent" ? unitShort(l.rentUnit) : null,
  deposit: l.deposit,
  original_price: l.mrp,
  age: l.purchasedOn ? ageText(ageMonths(l.purchasedOn)) : null,
  seller_trust: trustLevel(l.seller.plume, l.seller.ratedDeals).label,
  hostel: l.pickupHostel,
  bids: l.mode === "auction" ? l.bidCount : undefined,
});

/**
 * Builds the tool set for one request.
 * @param viewer the signed-in student (or null for guests)
 * @param onCards called with the listings a tool returned, so the UI can show real cards
 */
export function mayuTools(viewer: Viewer | null, onCards: (cards: ListingCard[]) => void) {
  return {
    search_listings: tool({
      description: "Search active i-bay listings. Use short keywords (brand, model, item). Returns at most 6 items.",
      inputSchema: z.object({
        query: z.string().describe("Keywords, e.g. 'fx-991es' or 'yonex racquet'"),
        mode: z.enum(["sell", "rent", "auction"]).optional().describe("Only buy, rent or auction listings"),
        max_price: z.number().int().optional().describe("Upper price limit in rupees"),
        sort: z.enum(["best", "low", "off", "new"]).optional().describe("low = cheapest first"),
      }),
      execute: async ({ query, mode, max_price, sort }) => {
        if (!dbReady()) return { count: 0, items: [] };
        try {
          const { items } = await browseListings({ q: query, modes: mode ? [mode] : undefined, max: max_price, sort: sort ?? "best", limit: 6 }, viewer);
          onCards(items);
          return { count: items.length, items: items.map(brief) };
        } catch {
          return { count: 0, items: [] };
        }
      },
    }),
    get_listing: tool({
      description: "Get full details of one listing by id.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        if (!dbReady()) return { found: false };
        try {
          const l = await getListingDetail(id, viewer);
          if (!l || l.status !== "active") return { found: false };
          onCards([l]);
          return { found: true, ...brief(l), description: l.description.slice(0, 400), specs: l.specs };
        } catch {
          return { found: false };
        }
      },
    }),
    list_open_requests: tool({
      description: "List what people on campus are looking for right now.",
      inputSchema: z.object({ query: z.string().optional() }),
      execute: async ({ query }) => {
        if (!dbReady()) return [];
        try {
          const rs = await listRequests("urgent", viewer?.id, 30);
          const f = query ? rs.filter((r) => r.text.toLowerCase().includes(query.toLowerCase())) : rs;
          return f.slice(0, 6).map((r) => ({ text: r.text, budget: r.budget, needed_by: r.neededBy, votes: r.votes }));
        } catch {
          return [];
        }
      },
    }),
    explain_plume: tool({
      description: "Explain the Plume trust score and levels.",
      inputSchema: z.object({}),
      execute: async () => ({
        formula: "delta = K(n) * (rating/10) * w; K(n) = max(6, 40/sqrt(1+n/3)); w = clamp(1 + raterPlume/400, 0.5, 1.5)",
        levels: ["Top rated: 150+", "Trusted: 60 to 149", "Building trust: 0 to 59", "Mixed reviews: -1 to -59", "Flagged: -60 or lower"],
        notes: "Everyone starts at 0. Both sides rate after every deal from -10 to +10 with a reason.",
      }),
    }),
    get_my_stats: tool({
      description: "The signed-in user's Plume, level, deals and hostel.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!viewer || !dbReady()) return { signed_in: false };
        try {
          const deals = await listDeals(viewer.id);
          return { signed_in: true, plume: viewer.plume, level: trustLevel(viewer.plume, viewer.ratedDeals).label, rated_deals: viewer.ratedDeals, deals: deals.length, hostel: viewer.hostel };
        } catch {
          return { signed_in: false };
        }
      },
    }),
  };
}

export const MAYU_SYSTEM = `You are Mayu, the peacock assistant of i-bay, IIM Indore's campus marketplace.
- Find things for students using the tools. Never invent listings, prices or people: only mention items returned by tools.
- Keep answers to 1 to 3 short sentences. Plain words, no emoji, no em dashes.
- Prices are whole rupees, written like ₹1,200. Rentals show a unit (/hr, /day, /week).
- When both renting and buying exist, compare sensibly: renting suits one-off needs (an exam day, one event); buying suits regular use.
- If nothing matches, say so and suggest posting a request ("I am looking for a...").
- Payments are always UPI or cash at handover. Food drops are only visible inside your own hostel.`;
