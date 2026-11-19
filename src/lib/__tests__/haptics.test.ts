import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triggerHaptic } from "../haptics";

describe("triggerHaptic", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("calls navigator.vibrate with appropriate pattern when supported", () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(global, "navigator", {
      value: { vibrate: vibrateMock },
      writable: true,
      configurable: true,
    });

    triggerHaptic("light");
    expect(vibrateMock).toHaveBeenCalledWith(12);

    triggerHaptic("medium");
    expect(vibrateMock).toHaveBeenCalledWith(28);

    triggerHaptic("success");
    expect(vibrateMock).toHaveBeenCalledWith([15, 60, 25]);
  });

  it("handles environment without vibrate gracefully without throwing", () => {
    Object.defineProperty(global, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    expect(() => triggerHaptic("light")).not.toThrow();
  });
});
