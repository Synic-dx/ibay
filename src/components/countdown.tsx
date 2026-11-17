"use client";
/**
 * FEATURE: Live countdown timer (auctions and food drops)
 * WHAT: Ticks every second. With `hotMin`, turns amber and then red as the
 *       end gets close (drops under 10 min, auctions under 1 h).
 */
import { useEffect, useState } from "react";
import { left, urgency } from "@/lib/format";

export function Countdown({ endsAt, hotMin, className = "" }: { endsAt: string; hotMin?: number; className?: string }) {
  // WHY: start with null so server and browser render the same text, then tick.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const n = now ?? new Date(endsAt).getTime() - 1;
  const tone = hotMin && now ? urgency(endsAt, hotMin, n) : "";
  return (
    <span className={`mono ${tone} ${className}`} suppressHydrationWarning>
      {now ? left(endsAt, n) : "··"}
    </span>
  );
}
