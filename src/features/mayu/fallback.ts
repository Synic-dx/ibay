/**
 * FEATURE: Mayu without an OpenAI key
 * WHAT: A small keyword answerer (the prototype's logic) so Mayu still works
 *       in the demo if the AI provider is down or not configured. It uses the
 *       same browse search, so cards are still real listings.
 */
import "server-only";
import { browseListings } from "@/features/listings/queries";
import { dbReady } from "@/lib/supabase/server";
import { fmt, unitShort } from "@/lib/format";
import type { Viewer } from "@/lib/auth/session";
import type { ListingCard } from "@/features/listings/types";

const STOP = new Set("cheapest cheap find show me for a an the to rent buy search any some is there i want need looking under below of in on with please get".split(" "));

/**
 * Answers a question with real listings.
 * @returns text (may contain **bold**) and the cards to show
 */
export async function fallbackAnswer(q: string, viewer: Viewer | null): Promise<{ text: string; cards: ListingCard[] }> {
  const s = q.toLowerCase();
  if (/plume|trust|rating|score|karma|review/.test(s)) {
    return {
      text: "Everyone has a Plume score that starts at 0. After each deal both people rate it from -10 to +10 with a reason. New members move fast and veterans move slowly, so one bad review can't erase a good record. 60+ is Trusted, 150+ is Top rated.",
      cards: [],
    };
  }
  if (/(how|where).*(sell|list)/.test(s)) return { text: "Tap **Sell**, add a photo, a title with brand and model, your price and the original price. It takes a minute.", cards: [] };
  const modes = /auction|bid/.test(s) ? ["auction"] : /\brent/.test(s) ? ["rent"] : /\bbuy\b/.test(s) ? ["sell"] : undefined;
  const max = Number(s.match(/under\s*₹?\s*(\d+)/)?.[1]) || undefined;
  const words = s.replace(/[^a-z0-9 -]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
  const cheap = /cheap|lowest|best price/.test(s);
  if (!dbReady()) {
    return { text: "I can help you search listings once the catalog database is connected.", cards: [] };
  }
  let items: ListingCard[] = [];
  try {
    const res = await browseListings({ q: words.join(" "), modes, max, sort: cheap ? "low" : "best", limit: 6 }, viewer);
    items = res.items;
  } catch {
    return { text: "I had trouble searching the catalog right now. Please try again.", cards: [] };
  }
  if (!items.length) return { text: `Nothing matches that right now. Want to post it on **Looking for**? People who have it can reply with a photo and price.`, cards: [] };
  const price = (l: ListingCard) => fmt(l.price) + (l.mode === "rent" ? "/" + unitShort(l.rentUnit) : "");
  const r = items.find((l) => l.mode === "rent");
  const b = items.find((l) => l.mode === "sell");
  if (cheap && r && b) {
    return {
      text: `Two ways to get it. Cheapest to **rent**: ${r.title} at **${price(r)}**. Cheapest to **buy**: ${b.title} at **${price(b)}**. Renting suits a one-off need; buy if you will use it often.`,
      cards: [r, b, ...items.filter((x) => x !== r && x !== b)].slice(0, 4),
    };
  }
  const c = items[0];
  return { text: cheap ? `Cheapest is **${c.title}** at **${price(c)}**.` : `Found ${items.length} on campus. Here are the best matches.`, cards: items.slice(0, 4) };
}
