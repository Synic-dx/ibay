"use client";
/**
 * FEATURE: LinkedIn-style messaging dock (desktop >= 1080px) [RUBRIC:RESPONSIVE]
 * WHAT: A "Messaging" bar at the bottom right that opens your thread list,
 *       and a pop-up chat window (minimise, expand to full page, close).
 *       Hidden on phones (they use the Chats tab) and on the full chat page.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { useApp } from "@/components/app-context";
import { ago, fmt } from "@/lib/format";
import { TrustLine } from "@/features/listings/components/parts";
import { fetchThread, fetchThreads } from "./actions";
import { ThreadView } from "./thread-view";
import { OPEN_CHAT_EVENT, type OpenChatDetail } from "./use-open-chat";

export function MessagingDock() {
  const { viewer, openAuth, counts } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
  const [q, setQ] = useState("");
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

  const threads = useQuery({ queryKey: ["threads"], queryFn: () => fetchThreads(), enabled: Boolean(viewer && desk && (open || win)) });
  const thread = useQuery({
    queryKey: ["thread", win],
    queryFn: () => (win && win !== "pending" ? fetchThread(win) : null),
    enabled: Boolean(viewer && desk && win && win !== "pending"),
  });

  if (!desk || path.startsWith("/messages")) return null;
  const list = (threads.data ?? []).filter((t) => !q || t.other.name.toLowerCase().includes(q.toLowerCase()));
  const t = thread.data;

  return (
    <div className="dock">
      {viewer && win && (
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
      )}
      <section className={`dk-list ${open && viewer ? "open" : ""}`}>
        <header
          className="dk-h"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => (viewer ? setOpen(!open) : openAuth({ reason: "Sign in to message buyers and sellers" }))}
          onKeyDown={(e) => e.key === "Enter" && (viewer ? setOpen(!open) : openAuth({ reason: "Sign in to message buyers and sellers" }))}
        >
          {viewer ? (
            <Avatar name={viewer.name} url={viewer.avatarUrl} color={viewer.avatarColor} size={30} />
          ) : (
            <span className="dk-av">
              <Icon name="chat" className="icon i16" />
            </span>
          )}
          <span className="dk-t">
            <b>Messaging</b>
          </span>
          {viewer && counts.unreadChats > 0 && (
            <i className="cnt" style={{ position: "static", border: 0 }}>
              {counts.unreadChats}
            </i>
          )}
          <span className="dk-ib" aria-hidden="true">
            <Icon name={open ? "down" : "up"} className="icon i16" />
          </span>
        </header>
        {open && viewer && (
          <>
            <div className="dk-search">
              <Icon name="search" className="icon i16" />
              <input placeholder="Search messages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search messages" />
            </div>
            <div className="dk-threads">
              {list.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  className={`dk-row ${th.unread ? "unread" : ""} ${win === th.id ? "on" : ""}`}
                  onClick={() => {
                    setWin(th.id);
                    setMin(false);
                  }}
                >
                  <Avatar name={th.other.name} url={th.other.avatarUrl} color={th.other.avatarColor} size={40} />
                  <span className="tx">
                    <span className="between">
                      <b>{th.other.name}</b>
                      <span className="faint xs">{th.last ? ago(th.last.at) : ""}</span>
                    </span>
                    <span className="xs" style={{ color: "var(--brand-ink)" }}>
                      {th.listing ? th.listing.title : th.other.hostel}
                    </span>
                    <span className="dk-last">
                      {th.last ? (th.last.mine ? "You: " : "") + (th.last.kind === "offer" ? `Offer ${fmt(th.last.amount ?? 0)}` : th.last.body) : "New chat"}
                    </span>
                  </span>
                  {th.unread > 0 && (
                    <i className="cnt" style={{ position: "static", border: 0 }}>
                      {th.unread}
                    </i>
                  )}
                </button>
              ))}
              {threads.isSuccess && !list.length && <p className="faint sm pad">No chats yet.</p>}
              {threads.isLoading && <p className="faint sm pad">Loading…</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
