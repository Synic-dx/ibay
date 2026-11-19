import { describe, it, expect } from "vitest";
import manifest from "../manifest";

describe("PWA Web App Manifest", () => {
  it("returns standalone PWA manifest configuration for i-bay", () => {
    const config = manifest();
    expect(config.name).toContain("i-bay");
    expect(config.short_name).toBe("i-bay");
    expect(config.display).toBe("standalone");
    expect(config.background_color).toBe("#02505F");
    expect(config.theme_color).toBe("#02505F");
    expect(config.icons).toBeDefined();
    expect(config.icons?.[0].src).toBe("/icon.svg");
  });
});
