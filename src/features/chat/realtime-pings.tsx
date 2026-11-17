"use client";
/**
 * FEATURE: Realtime updates for chats and notifications
 * WHAT: Listens on the signed-in user's secret ping channel. When a ping
 *       arrives (new message, offer, outbid...), it refreshes the chat caches
 *       (TanStack Query) and the page data (router.refresh) for unread badges.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/components/app-context";
import { browserClient } from "@/lib/supabase/browser";

export function RealtimePings() {
  const { viewer } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sb = browserClient();
    if (!sb || !viewer) return;
    const ch = sb
      .channel(viewer.channel)
      .on("broadcast", { event: "ping" }, () => {
        qc.invalidateQueries({ queryKey: ["threads"] });
        qc.invalidateQueries({ queryKey: ["thread"] });
        // WHY: debounce so a burst of messages causes one refresh.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 600);
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [viewer, qc, router]);
  return null;
}
