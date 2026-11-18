import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, isStepCount } from "ai";
import { MAYU_SYSTEM, mayuTools } from "./tools";
import type { Viewer } from "@/lib/auth/session";
import type { ListingCard } from "@/features/listings/types";

/** Available models in cascade priority (Flash Lite high quotas first, followed by standard Flash). */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

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
    msg.includes("unknown model")
  );
}

export type StreamPart =
  | { type: "text-delta"; text: string }
  | { type: "tool-result" }
  | { type: "error"; error: unknown };

/**
 * Executes a streaming query using the Gemini fallback cascade.
 * Iterates through GEMINI_FALLBACK_MODELS if an early model error or rate-limit is encountered.
 * Returns null if all models fail, signaling the caller to trigger the database keyword fallback.
 */
export async function runGeminiCascade({
  messages,
  viewer,
  onCards,
  apiKey,
  onTextDelta,
  onToolResult,
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  viewer: Viewer | null;
  onCards: (cards: ListingCard[]) => void;
  apiKey: string;
  onTextDelta: (delta: string) => void;
  onToolResult: () => void;
}): Promise<{ success: boolean; modelUsed?: string }> {
  const google = createGoogleGenerativeAI({ apiKey });

  for (const modelName of GEMINI_FALLBACK_MODELS) {
    let receivedAny = false;
    let textAcc = "";
    try {
      const result = streamText({
        model: google(modelName),
        system: MAYU_SYSTEM,
        temperature: 0.3,
        messages,
        tools: mayuTools(viewer, onCards),
        stopWhen: isStepCount(4),
      });

      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          const p = part as unknown as { text?: string; delta?: string };
          const v = p.text ?? p.delta ?? "";
          if (v) {
            receivedAny = true;
            textAcc += v;
            onTextDelta(v);
          }
        } else if (part.type === "tool-result") {
          onToolResult();
        } else if (part.type === "error") {
          throw (part as { error?: unknown }).error || new Error("stream error");
        }
      }

      if (receivedAny && textAcc.trim()) {
        return { success: true, modelUsed: modelName };
      }
    } catch (err) {
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
