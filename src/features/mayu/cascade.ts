/**
 * FEATURE: Mayu's Gemini model cascade [RUBRIC:EXTRA]
 * WHAT: Streams an answer from Gemini, trying the next model if one is out of
 *       quota or unavailable. Every attempt has a time limit, so Mayu can never
 *       hang: if Gemini is too slow, the route answers with the instant keyword
 *       search instead.
 * SPEED: the route runs the database search first and passes the results in
 *        `context`, so Gemini can usually answer in one call instead of two
 *        (decide to search, then answer).
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, isStepCount } from "ai";
import { MAYU_SYSTEM, mayuTools } from "./tools";
import type { Viewer } from "@/lib/auth/session";
import type { ListingCard } from "@/features/listings/types";

/**
 * Models in priority order. Only models that answered with our key are listed
 * (checked 19 Nov 2026). Removed: 2.5/2.0 flash and 2.5 flash-lite ("no longer
 * available"), 1.5 / 3 flash ("not found"), 3.6 / 3.8 flash (never answered,
 * which is what made Mayu spin forever).
 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
];

/** A model that hasn't started answering within this time is skipped. */
const FIRST_RESPONSE_MS = 5_000;
/** Hard cap for the whole cascade; after this the keyword answer is used. */
const TOTAL_DEADLINE_MS = 12_000;

export function isRateLimitOrModelError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("exhausted") ||
    msg.includes("rate") ||
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("is not supported") ||
    msg.includes("unknown model") ||
    msg.includes("no longer available") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted") ||
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("try again later")
  );
}

export type StreamPart =
  | { type: "text-delta"; text: string }
  | { type: "tool-result" }
  | { type: "error"; error: unknown };

/**
 * Streams one answer, trying each model in GEMINI_FALLBACK_MODELS in turn.
 * @param context optional facts for this question (e.g. listings already found and shown)
 * @returns success false if no model answered in time, so the caller can use the keyword answer
 */
export async function runGeminiCascade({
  messages,
  viewer,
  onCards,
  apiKey,
  onTextDelta,
  onToolResult,
  context,
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  viewer: Viewer | null;
  onCards: (cards: ListingCard[]) => void;
  apiKey: string;
  onTextDelta: (delta: string) => void;
  onToolResult: () => void;
  context?: string;
}): Promise<{ success: boolean; modelUsed?: string }> {
  const google = createGoogleGenerativeAI({ apiKey });
  const deadline = AbortSignal.timeout(TOTAL_DEADLINE_MS);
  const system = context ? `${MAYU_SYSTEM}\n\n${context}` : MAYU_SYSTEM;

  for (const modelName of GEMINI_FALLBACK_MODELS) {
    if (deadline.aborted) break;
    let receivedAny = false;
    let textAcc = "";
    // WHY: stop waiting on a model that hasn't started answering, instead of hanging.
    const firstResponse = new AbortController();
    const timer = setTimeout(() => firstResponse.abort(new Error(`timeout: ${modelName} did not respond`)), FIRST_RESPONSE_MS);
    try {
      const result = streamText({
        model: google(modelName),
        system,
        temperature: 0.3,
        messages,
        tools: mayuTools(viewer, onCards),
        stopWhen: isStepCount(4),
        maxRetries: 0,
        abortSignal: AbortSignal.any([firstResponse.signal, deadline]),
      });

      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          const p = part as unknown as { text?: string; delta?: string };
          const v = p.text ?? p.delta ?? "";
          if (v) {
            clearTimeout(timer);
            receivedAny = true;
            textAcc += v;
            onTextDelta(v);
          }
        } else if (part.type === "tool-call" || part.type === "tool-result") {
          // The model is working (searching), so it has responded in time.
          clearTimeout(timer);
          if (part.type === "tool-result") onToolResult();
        } else if (part.type === "error") {
          throw (part as { error?: unknown }).error || new Error("stream error");
        }
      }
      clearTimeout(timer);

      if (receivedAny && textAcc.trim()) {
        return { success: true, modelUsed: modelName };
      }
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[Mayu Cascade] Model ${modelName} failed:`, err instanceof Error ? err.message : err);
      // If tokens were already sent to client, do not restart with a fresh model to prevent message concatenation
      if (receivedAny) {
        break;
      }
      // If error is not a retryable quota/model issue (e.g. auth failed), abort cascade immediately
      if (!isRateLimitOrModelError(err)) {
        break;
      }
      continue;
    }
  }

  return { success: false };
}
