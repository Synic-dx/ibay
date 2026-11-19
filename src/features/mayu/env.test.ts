import { describe, it, expect } from "vitest";

describe("Mayu Environment Configuration", () => {
  it("resolves @ai-sdk/google correctly", async () => {
    // Dynamic import to test if @ai-sdk/google is installed and loadable
    const mod = await import("@ai-sdk/google");
    expect(mod.createGoogleGenerativeAI).toBeDefined();
  });
});
