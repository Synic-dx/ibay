"use client";
/**
 * FEATURE: Top progress bar while a page is loading
 * WHAT: A thin brand-coloured bar at the top of the screen. It appears only if
 *       a click takes longer than 120 ms, creeps towards 90 %, then completes
 *       and fades when the new page is ready. The current page fades a little
 *       meanwhile, so it is clear the click registered. Fed by <Link> (components/ui/link).
 */
import { useEffect, useState, useSyncExternalStore } from "react";

let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Tiny store: how many clicks are waiting for the server right now. */
export const navProgress = {
  start() {
    pending += 1;
    emit();
  },
  stop() {
    pending = Math.max(0, pending - 1);
    emit();
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function NavProgress() {
  const busy = useSyncExternalStore(subscribe, () => pending > 0, () => false);
  const [phase, setPhase] = useState<"idle" | "on" | "done">("idle");

  useEffect(() => {
    if (busy) {
      // WHY: wait a moment so fast (prefetched) clicks don't flash the bar.
      const t = setTimeout(() => setPhase("on"), 120);
      return () => clearTimeout(t);
    }
    // Finish only a bar that is showing; let it fade out, then reset.
    const t1 = setTimeout(() => setPhase((p) => (p === "on" ? "done" : p)), 0);
    const t2 = setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [busy]);

  // Fade the current page while waiting so it is clear the click registered.
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "on") root.dataset.nav = "busy";
    else delete root.dataset.nav;
  }, [phase]);

  return <div className={`navprog ${phase}`} role="progressbar" aria-hidden={phase === "idle"} aria-label="Loading page" />;
}
