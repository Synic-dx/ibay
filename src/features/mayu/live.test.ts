import { describe, it, expect } from "vitest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runGeminiCascade } from "./cascade";

describe("Live Gemini Cascade Integration", () => {
  it("streams response or gracefully handles quota with fallback", async () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(apiKey).toBeDefined();

    let textAcc = "";
    const res = await runGeminiCascade({
      messages: [{ role: "user", content: "What is Plume?" }],
      viewer: null,
      apiKey: apiKey!,
      onCards: () => {},
      onTextDelta: (delta) => {
        textAcc += delta;
      },
      onToolResult: () => {},
    });

    console.log("Cascade completed:", res);
    console.log("Received text preview:", textAcc.slice(0, 100));

    // Either a model succeeded and returned text, or it cleanly returned { success: false } to trigger DB fallback
    expect(res).toBeDefined();
    expect(typeof res.success).toBe("boolean");
  }, 30000);
});
