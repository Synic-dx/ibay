"use client";
/**
 * FEATURE: Desktop Floating Chat Popup (>= 1080px) [RUBRIC:RESPONSIVE]
 * WHAT: When a user clicks "Chat with seller" on any item, this floating chat
 *       window pops up in the bottom-right corner so they can message without leaving
 *       the page. Includes minimize, expand to full page, and close (X).
 *       When idle, nothing is rendered (no repetitive persistent bottom dock;
 *       the top navigation "Chats" link serves as the message center).
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { useApp } from "@/components/app-context";
import { TrustLine } from "@/features/listings/components/parts";
import { fetchThread } from "./actions";
import { ThreadView } from "./thread-view";
import { OPEN_CHAT_EVENT, type OpenChatDetail } from "./use-open-chat";

export function MessagingDock() {
  const { viewer } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [win, setWin] = useState<string | null>(null);
  const [targetOther, setTargetOther] = useState<{
    id?: string;
    name: string;
    avatarUrl?: string | null;
    avatarColor?: string;
    plume?: number;
    ratedDeals?: number;
    hostel?: string;
  } | null>(null);
  const [min, setMin] = useState(false);
  const [desk, setDesk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1080px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenChatDetail>).detail;
      if (!detail || !detail.id) {
        setWin(null);
        setTargetOther(null);
        return;
      }
      setWin(detail.id);
      setMin(false);
      if (detail.other) {
        setTargetOther(detail.other);
      }
    };
    window.addEventListener(OPEN_CHAT_EVENT, handler);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener(OPEN_CHAT_EVENT, handler);
    };
  }, []);

  const thread = useQuery({
    queryKey: ["thread", win],
    queryFn: () => (win && win !== "pending" ? fetchThread(win) : null),
    enabled: Boolean(viewer && desk && win && win !== "pending"),
  });

  if (!desk || path.startsWith("/messages") || !viewer || !win) return null;
  const t = thread.data;

  return (
    <div className="dock" role="region" aria-label="Active chat window">
      <section className={`dk-win ${min ? "min" : ""}`} aria-label={t ? `Chat with ${t.other.name}` : targetOther ? `Chat with ${targetOther.name}` : "Chat"}>
        <header className="dk-h" onClick={() => setMin(!min)}>
          <Avatar
            name={t?.other.name ?? targetOther?.name ?? "..."}
            url={t?.other.avatarUrl ?? targetOther?.avatarUrl}
            color={t?.other.avatarColor ?? targetOther?.avatarColor ?? "var(--brand)"}
            size={30}
          />
          <span className="dk-t">
            <b>{t?.other.name ?? targetOther?.name ?? "Opening chat…"}</b>
            <span>
              {(t?.other || targetOther) ? (
                <TrustLine
                  plume={t?.other.plume ?? targetOther?.plume ?? 50}
                  ratedDeals={t?.other.ratedDeals ?? targetOther?.ratedDeals ?? 0}
                  deals={false}
                />
              ) : (
                <small style={{ color: "var(--ink-3)" }}>Connecting…</small>
              )}
            </span>
          </span>
          <button
            type="button"
            className="dk-ib"
            onClick={(e) => (e.stopPropagation(), win !== "pending" && router.push(`/messages/${win}`))}
            aria-label="Open full chat"
            title="Open full chat"
            disabled={win === "pending"}
          >
            <Icon name="expand" className="icon i16" />
          </button>
          <button type="button" className="dk-ib" onClick={(e) => (e.stopPropagation(), setMin(!min))} aria-label={min ? "Expand" : "Minimise"}>
            <Icon name={min ? "up" : "min"} className="icon i16" />
          </button>
          <button
            type="button"
            className="dk-ib"
            onClick={(e) => (e.stopPropagation(), setWin(null), setTargetOther(null))}
            aria-label="Close chat"
            title="Close chat"
          >
            <Icon name="x" className="icon i16" />
          </button>
        </header>
        {!min && (
          t ? (
            <ThreadView key={t.id} initial={t} compact />
          ) : (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", minHeight: "220px", justifyContent: "flex-end" }}>
              <div className="sk" style={{ height: "36px", width: "65%", borderRadius: "14px" }} />
              <div className="sk" style={{ height: "46px", width: "80%", alignSelf: "flex-end", borderRadius: "14px" }} />
              <div className="sk" style={{ height: "32px", width: "55%", borderRadius: "14px" }} />
            </div>
          )
        )}
      </section>
    </div>
  );
}
