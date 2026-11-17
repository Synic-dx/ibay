/**
 * FEATURE: Chats list (phones; desktop also has the dock) [RUBRIC:EXTRA]
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { ago, fmt } from "@/lib/format";
import { listThreads } from "@/features/chat/queries";
import { ChatSearch } from "@/features/chat/chat-search";

export const metadata: Metadata = { title: "Chats" };

export default async function MessagesPage() {
  const viewer = await requireViewer("/messages");
  const threads = await listThreads(viewer.id);
  return (
    <>
      <SubBar
        title="Chats"
        actions={
          <Link className="ib" href="/deals" aria-label="Your deals">
            <Icon name="bag" />
          </Link>
        }
      />
      <main className="withtabs" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <ChatSearch />
        {threads.length ? (
          threads.map((t) => (
            <Link key={t.id} className={`thr ${t.unread ? "unread" : ""}`} data-n={t.other.name.toLowerCase()} href={`/messages/${t.id}`}>
              <Avatar name={t.other.name} url={t.other.avatarUrl} color={t.other.avatarColor} size={48} />
              <span className="tx">
                <span className="between">
                  <b>{t.other.name}</b>
                  <span className="faint xs">{t.last ? ago(t.last.at) : ""}</span>
                </span>
                {t.listing && (
                  <div className="xs" style={{ color: "var(--brand-ink)" }}>
                    <Icon name="tag" className="icon i14" /> {t.listing.deleted ? "Listing deleted" : t.listing.title}
                  </div>
                )}
                <div>{t.last ? (t.last.mine ? "You: " : "") + (t.last.kind === "offer" ? `Offer ${fmt(t.last.amount ?? 0)}` : t.last.body) : "New chat"}</div>
              </span>
              {t.unread > 0 && (
                <span className="cnt" style={{ position: "static", border: 0 }}>
                  {t.unread}
                </span>
              )}
            </Link>
          ))
        ) : (
          <div className="empty">
            <span className="ei">
              <Icon name="chat" />
            </span>
            <h3>No chats yet</h3>
            <p className="sm">Message a seller from any listing.</p>
          </div>
        )}
      </main>
    </>
  );
}
