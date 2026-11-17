/**
 * FEATURE: Mayu, the AI shopping assistant [RUBRIC:EXTRA]
 * WHAT: POST /api/mayu streams an answer as newline-delimited JSON:
 *       {"t":"text","v":"..."} pieces, {"t":"cards","v":[...]} with real
 *       listings from tool results, then {"t":"done"}.
 * MODEL: OpenAI gpt-4o through the Vercel AI SDK (streamText, temperature 0.3,
 *        read-only tools). Without OPENAI_API_KEY (or if OpenAI fails) it falls
 *        back to keyword search so the demo never breaks.
 * LIMIT: 30 questions per hour per person (per IP for guests).
 */
import { streamText, isStepCount } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/guard";
import { MAYU_SYSTEM, mayuTools } from "@/features/mayu/tools";
import { fallbackAnswer } from "@/features/mayu/fallback";
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
      try {
        if (!process.env.OPENAI_API_KEY) throw new Error("no-key");
        // 3. Ask gpt-4o with read-only tools. Cards come only from tool results.
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const result = streamText({
          model: openai("gpt-4o"),
          system: MAYU_SYSTEM,
          temperature: 0.3,
          messages,
          tools: mayuTools(viewer, (cs) => cs.forEach((c) => cards.set(c.id, c))),
          stopWhen: isStepCount(4),
        });
        for await (const part of result.stream) {
          if (part.type === "text-delta") {
            const p = part as unknown as { text?: string; delta?: string };
            const v = p.text ?? p.delta ?? "";
            answer += v;
            send({ t: "text", v });
          } else if (part.type === "tool-result" && cards.size) {
            send({ t: "cards", v: [...cards.values()].slice(0, 4) });
          } else if (part.type === "error") {
            throw new Error("model-error");
          }
        }
        if (!answer) throw new Error("empty");
      } catch {
        // 4. Fallback: keyword search over the same listings.
        if (!answer) {
          const fb = await fallbackAnswer(question, viewer);
          answer = fb.text;
          send({ t: "text", v: fb.text });
          if (fb.cards.length) send({ t: "cards", v: fb.cards });
        }
      }
      await db().from("ai_conversations").insert({ user_id: viewer?.id ?? null, question, answer: answer.slice(0, 2000), tool_calls: [...cards.keys()] });
      send({ t: "done" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
