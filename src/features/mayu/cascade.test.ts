import { describe, it, expect } from "vitest";
import { GEMINI_FALLBACK_MODELS, isRateLimitOrModelError } from "./cascade";

describe("Gemini Cascade Configuration", () => {
  it("defines cascade models with Flash Lite as priority", () => {
    expect(GEMINI_FALLBACK_MODELS.length).toBeGreaterThanOrEqual(3);
    expect(GEMINI_FALLBACK_MODELS[0]).toContain("flash");
  });

  it("detects rate limit and model errors accurately", () => {
    expect(isRateLimitOrModelError(new Error("Resource has been exhausted (e.g. check quota)"))).toBe(true);
    expect(isRateLimitOrModelError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isRateLimitOrModelError(new Error("models/gemini-xxx is not found"))).toBe(true);
    expect(isRateLimitOrModelError(new Error("random other error"))).toBe(false);
    expect(isRateLimitOrModelError(new Error("API_KEY_INVALID"))).toBe(false);
    expect(isRateLimitOrModelError(new Error("PERMISSION_DENIED"))).toBe(false);
  });
});
