/**
 * FEATURE: Mayu, the AI shopping assistant [RUBRIC:EXTRA]
 * WHAT: POST /api/mayu streams an answer as newline-delimited JSON:
 *       {"t":"text","v":"..."} pieces, {"t":"cards","v":[...]} with real
 *       listings from tool results, then {"t":"done"}.
 * SPEED: the database search runs first and its cards are sent at once; Gemini
 *        then writes the reply (usually one call). Every model has a time limit.
 * MODEL: Google Gemini free-tier multi-model cascade (Gemini Flash Lite priority,
 *        falling back down tiers on 429/quota error).
 *        Without GEMINI_API_KEY (or if all models fail) it falls back to
 *        instant local keyword search so the demo never breaks.
 * LIMIT: 30 questions per hour per person (per IP for guests).
 */
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db, dbReady } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/guard";
import { fallbackAnswer } from "@/features/mayu/fallback";
import { runGeminiCascade } from "@/features/mayu/cascade";
import { brief } from "@/features/mayu/tools";
import type { ListingCard } from "@/features/listings/types";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) }))
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  // 1. Validate the request.
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ask Mayu something first." }, { status: 400 });
  const messages = parsed.data.messages;
  const question = messages.at(-1)!.content.trim();

  // 2. Rate limit: 30 an hour.
  const viewer = await getViewer();
  const key = viewer ? `mayu:user:${viewer.id}` : `mayu:ip:${await clientIp()}`;
  if (!(await rateLimit(key, 3600, 30))) {
    return Response.json({ error: "Mayu needs a break. You can ask 30 questions an hour." }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const cards = new Map<string, ListingCard>();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      let answer = "";
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      // SPEED: search the database first (well under a second) and show the cards
      // straight away, then let Gemini write the reply using those results.
      // Gemini then usually needs one call instead of two (search, then answer).
      let quick: Awaited<ReturnType<typeof fallbackAnswer>> | null = null;
      if (dbReady()) {
        try {
          quick = await fallbackAnswer(question, viewer);
          if (quick.cards.length) {
            quick.cards.forEach((c) => cards.set(c.id, c));
            send({ t: "cards", v: quick.cards });
          }
        } catch (err) {
          console.warn("[Mayu Route] Quick search failed:", err);
        }
      }

      if (apiKey) {
        // Cards from Gemini's own searches replace the quick ones (the latest search wins).
        let latest: ListingCard[] = [];
        const context = quick?.cards.length
          ? `Listings already found for the latest question and shown to the student as cards (JSON): ${JSON.stringify(quick.cards.map(brief))}\nIf these answer the question, reply directly in 1-2 short sentences without calling search_listings. Search again only if they don't fit.`
          : undefined;
        try {
          await runGeminiCascade({
            messages,
            viewer,
            apiKey,
            context,
            onCards: (cs) => {
              latest = cs;
              cs.forEach((c) => cards.set(c.id, c));
            },
            onTextDelta: (v) => {
              answer += v;
              send({ t: "text", v });
            },
            onToolResult: () => {
              if (latest.length) send({ t: "cards", v: latest.slice(0, 4) });
            },
          });
        } catch (err) {
          console.warn("[Mayu Route] Gemini cascade error:", err);
        }
      }

      // Fallback: the keyword answer when Gemini is missing, out of quota or too slow.
      if (!answer && quick) {
        answer = quick.text;
        send({ t: "text", v: quick.text });
      }
      if (!answer) {
        try {
          if (dbReady()) {
            const fb = await fallbackAnswer(question, viewer);
            answer = fb.text;
            send({ t: "text", v: fb.text });
            if (fb.cards.length) send({ t: "cards", v: fb.cards });
          } else {
            answer = "I am ready to help, but the database connection is currently pending. Please check back shortly.";
            send({ t: "text", v: answer });
          }
        } catch (err) {
          console.warn("[Mayu Route] Fallback answer error:", err);
          answer = "I could not find matches right now. Please try asking again.";
          send({ t: "text", v: answer });
        }
      }

      try {
        if (dbReady()) {
          await db().from("ai_conversations").insert({
            user_id: viewer?.id ?? null,
            question,
            answer: answer.slice(0, 2000),
            tool_calls: [...cards.keys()],
          });
        }
      } catch (err) {
        console.warn("[Mayu Route] Failed to log conversation:", err);
      }

      send({ t: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
