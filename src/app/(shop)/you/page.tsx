/**
 * FEATURE: You (your profile hub)
 * WHAT: Plume score with progress to the next level, shortcuts (deals, saved,
 *       My listings, requests), settings, sign out and the reviews you received.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { ThemeSwitchRow } from "@/components/shell/theme-toggle";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { nextLevel, plumeK, trustLevel } from "@/lib/plume";
import { reviewsFor } from "@/features/profile/queries";
import { ReviewRow } from "@/features/profile/review-row";
import { listDeals, canRate } from "@/features/deals/queries";
import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "You" };

export default async function YouPage() {
  const me = await requireViewer("/you");
  const [reviews, deals, { count: saved }, { count: live }] = await Promise.all([
    reviewsFor(me.id, 10),
    listDeals(me.id),
    db().from("saved_items").select("listing_id", { count: "exact", head: true }).eq("user_id", me.id),
    db().from("listings").select("id", { count: "exact", head: true }).eq("seller_id", me.id).eq("status", "active"),
  ]);
  const t = trustLevel(me.plume, me.ratedDeals);
  const nl = nextLevel(me.plume);
  const pend = deals.filter((d) => canRate(d) && !d.myRating).length;
  return (
    <>
      <SubBar
        title="You"
        actions={
          <Link className="ib" href="/account" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        }
      />
      <main className="withtabs">
        <div className="panel pad row" style={{ gap: 14 }}>
          <Avatar name={me.name} url={me.avatarUrl} color={me.avatarColor} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{me.name}</h2>
            <div className="faint xs" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {me.email}
            </div>
            <div className="xs muted row" style={{ gap: 4, marginTop: 2 }}>
              <Icon name="pin" className="icon i14" />
              {me.hostel}
              {me.room ? `, room ${me.room}` : ""}
            </div>
          </div>
          <Link className="ib" href={`/u/${me.id}`} aria-label="Public profile">
            <Icon name="chev" />
          </Link>
        </div>
        <Link className="panel pad stack" style={{ marginTop: 12, gap: 10, width: "100%", textAlign: "left" }} href="/trust">
          <div className="between">
            <span className="label">
              <Icon name="shield" />
              Your Plume score
            </span>
            <span className={`trust ${t.tone}`}>{t.label}</span>
          </div>
          <div className="between" style={{ alignItems: "flex-end" }}>
            <b className="mono" style={{ fontSize: 34, lineHeight: 1 }}>
              {me.plume > 0 ? "+" : ""}
              {Math.round(me.plume)}
            </b>
            <span className="xs faint">{me.ratedDeals} rated deals</span>
          </div>
          <div className="plumebar" role="progressbar" aria-valuenow={Math.round(nl.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the next level">
            <i style={{ width: `${nl.pct}%` }} />
          </div>
          <span className="xs muted">
            {nl.target ? `${Math.ceil(nl.target - me.plume)} more to reach ${nl.name}. Your next rating can move you up to ±${Math.round(plumeK(me.ratedDeals))}.` : "You are at the top level."}
          </span>
        </Link>
        <div className="g2" style={{ marginTop: 12 }}>
          {(
            [
              ["bag", "Your deals", `${deals.length} deals${pend ? ` · ${pend} to rate` : ""}`, "/deals"],
              ["heart", "Saved", `${saved ?? 0} items`, "/saved"],
              ["store", "My listings", `${live ?? 0} live`, "/my-listings"],
              ["list", "Requests", "Looking for...", "/requests"],
            ] as const
          ).map(([i, n, s, href]) => (
            <Link key={n} className="panel stat" href={href}>
              <Icon name={i} />
              <b style={{ fontSize: 15 }}>{n}</b>
              <span className="xs faint">{s}</span>
            </Link>
          ))}
        </div>
        <div className="lgroup" style={{ marginTop: 16 }}>
          <ThemeSwitchRow />
          <Link className="lrow" href="/account">
            <span className="li">
              <Icon name="pin" />
            </span>
            <span className="lt">
              <b>Hostel & contact</b>
              <span>
                {me.hostel}, WhatsApp {me.whatsapp ? "added" : "not added"}
              </span>
            </span>
            <Icon name="chev" />
          </Link>
          <Link className="lrow" href="/notifications">
            <span className="li">
              <Icon name="bell" />
            </span>
            <span className="lt">
              <b>Notifications</b>
            </span>
            <Icon name="chev" />
          </Link>
          <Link className="lrow" href="/trust">
            <span className="li">
              <Icon name="help" />
            </span>
            <span className="lt">
              <b>How trust works</b>
            </span>
            <Icon name="chev" />
          </Link>
          {me.role === "admin" && (
            <Link className="lrow" href="/admin">
              <span className="li">
                <Icon name="shieldAlert" />
              </span>
              <span className="lt">
                <b>Admin</b>
                <span>Reports, hidden listings, bans</span>
              </span>
              <Icon name="chev" />
            </Link>
          )}
          <form action={signOutAction}>
            <button type="submit" className="lrow">
              <span className="li" style={{ color: "var(--bad)" }}>
                <Icon name="logout" />
              </span>
              <span className="lt">
                <b style={{ color: "var(--bad)" }}>Sign out</b>
              </span>
            </button>
          </form>
        </div>
        <div className="sh" style={{ marginTop: 22 }}>
          <h2>
            <Icon name="star" />
            Reviews you received
          </h2>
        </div>
        <div className="panel pad">{reviews.length ? reviews.map((r) => <ReviewRow key={r.id} r={r} />) : <p className="faint sm">None yet. Complete a deal to get rated.</p>}</div>
      </main>
    </>
  );
}
