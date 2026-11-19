/**
 * FEATURE: Notifications (the bell)
 * WHAT: Outbid, offers, request replies, food drops in your hostel, price drops
 *       on saved items, bookings and ratings. Opening the page marks them read.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { after } from "next/server";
import { Icon } from "@/components/ui/icon";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { ago } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/notifications");
  const { data } = await db().from("notifications").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(60);
  // Mark them read after the page is sent (so this visit still shows which ones are new).
  after(async () => void (await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).is("read_at", null)));
  return (
    <>
      <SubBar title="Notifications" />
      <main className="withtabs" style={{ paddingLeft: 0, paddingRight: 0 }} role="list" aria-label="Notifications list">
        {(data ?? []).map((n) => (
          <Link
            key={n.id}
            role="listitem"
            className={`thr ${n.read_at ? "" : "unread"}`}
            href={n.link ?? "/"}
            aria-label={`${n.read_at ? "" : "Unread: "}${n.body}`}
          >
            <span className="li" style={{ width: 44, height: 44, borderRadius: 14, background: n.read_at ? "var(--sunken)" : "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand-ink)", flex: "none" }}>
              <Icon name={n.icon} />
            </span>
            <span className="tx">
              <span className="sm" style={{ display: "block", whiteSpace: "normal", color: "var(--ink)", fontWeight: n.read_at ? 400 : 600, lineHeight: 1.4 }}>
                {n.body}
              </span>
              <span className="faint xs" style={{ marginTop: 2, display: "inline-block" }}>{ago(n.created_at)}</span>
            </span>
          </Link>
        ))}
        {!data?.length && (
          <div className="empty" style={{ margin: "40px auto" }}>
            <span className="ei">
              <Icon name="bell" />
            </span>
            <h3>All quiet for now</h3>
            <p className="sm">You&apos;ll see updates here when someone makes an offer, outbids you, or drops prices on saved items.</p>
          </div>
        )}
      </main>
    </>
  );
}
