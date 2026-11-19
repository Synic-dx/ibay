/**
 * Subtle mobile haptic feedback helper using navigator.vibrate.
 * Safely no-ops in SSR environments, non-supporting browsers, or when vibration permissions are restricted.
 */

export type HapticFeedbackType = "light" | "medium" | "heavy" | "success" | "warning";

const VIBRATION_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  light: 12,
  medium: 28,
  heavy: 48,
  success: [15, 60, 25],
  warning: [30, 50, 30],
};

export function triggerHaptic(type: HapticFeedbackType = "light"): void {
  if (
    typeof navigator === "undefined" ||
    typeof (navigator as Navigator & { vibrate?: unknown }).vibrate !== "function"
  ) {
    return;
  }

  try {
    const pattern = VIBRATION_PATTERNS[type] ?? 12;
    navigator.vibrate(pattern);
  } catch {
    // Fail silently on browsers that throw on vibrate
  }
}
