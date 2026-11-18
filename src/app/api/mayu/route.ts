/**
 * FEATURE: Mayu, the AI shopping assistant [RUBRIC:EXTRA]
 * WHAT: POST /api/mayu streams an answer as newline-delimited JSON:
 *       {"t":"text","v":"..."} pieces, {"t":"cards","v":[...]} with real
 *       listings from tool results, then {"t":"done"}.
 * MODEL: Google Gemini free-tier multi-model cascade (Gemini Flash Lite priority,
 *        falling back down tiers on 429/quota error).
 *        Without GEMINI_API_KEY (or if all models fail) it falls back to
 *        instant local keyword search so the demo never breaks.
 * LIMIT: 30 questions per hour per person (per IP for guests).
 */
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/guard";
import { fallbackAnswer } from "@/features/mayu/fallback";
import { runGeminiCascade } from "@/features/mayu/cascade";
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

      if (apiKey) {
        try {
          await runGeminiCascade({
            messages,
            viewer,
            apiKey,
            onCards: (cs) => cs.forEach((c) => cards.set(c.id, c)),
            onTextDelta: (v) => {
              answer += v;
              send({ t: "text", v });
            },
            onToolResult: () => {
              if (cards.size) {
                send({ t: "cards", v: [...cards.values()].slice(0, 4) });
              }
            },
          });
        } catch (err) {
          console.warn("[Mayu Route] Gemini cascade error:", err);
        }
      }

      // Fallback: local database keyword search over the same listings if no AI response
      if (!answer) {
        const fb = await fallbackAnswer(question, viewer);
        answer = fb.text;
        send({ t: "text", v: fb.text });
        if (fb.cards.length) send({ t: "cards", v: fb.cards });
      }

      try {
        await db().from("ai_conversations").insert({
          user_id: viewer?.id ?? null,
          question,
          answer: answer.slice(0, 2000),
          tool_calls: [...cards.keys()],
        });
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
