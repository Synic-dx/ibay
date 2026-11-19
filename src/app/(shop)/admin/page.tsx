/**
 * FEATURE: /admin, moderation [RUBRIC:DATA-DISPLAY]
 * WHAT: Reports table (filter by status, sort newest / oldest) with Hide listing
 *       and Ban user, plus a CAPTCHA dashboard (pass/fail in the last 24 hours).
 * WHO: admins only; everyone else gets a 404.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { ago } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/validation/market";
import { AdminButtons } from "@/features/admin/admin-buttons";

export const metadata: Metadata = { title: "Admin" };

const REASON = Object.fromEntries(REPORT_REASONS);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; sort?: string }> }) {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "admin") notFound();
  const { status = "open", sort = "new" } = await searchParams;
  let q = db()
    .from("reports")
    .select("id,reason,details,status,created_at,listing_id,reported_user_id,reporter:profiles!reports_reporter_id_fkey(name),listing:listings(id,title,status),user:profiles!reports_reported_user_id_fkey(id,name,banned)")
    .order("created_at", { ascending: sort === "old" })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  const since = new Date(Date.now() - 864e5).toISOString();
  const [{ data: reports }, { count: capOk }, { count: capFail }, { count: hidden }, { count: banned }] = await Promise.all([
    q,
    db().from("captcha_logs").select("id", { count: "exact", head: true }).eq("success", true).gt("created_at", since),
    db().from("captcha_logs").select("id", { count: "exact", head: true }).eq("success", false).gt("created_at", since),
    db().from("listings").select("id", { count: "exact", head: true }).eq("status", "hidden"),
    db().from("profiles").select("id", { count: "exact", head: true }).eq("banned", true),
  ]);
  const link = (patch: Record<string, string>) => `/admin?${new URLSearchParams({ status, sort, ...patch })}`;

  return (
    <>
      <SubBar title="Admin" sub="Reports and safety" />
      <main className="withtabs">
        <div className="g2 stats4">
          {(
            [
              ["flag", "Open reports", (reports ?? []).filter((r) => r.status === "open").length],
              ["shield", "CAPTCHA passed (24 h)", capOk ?? 0],
              ["alert", "CAPTCHA failed (24 h)", capFail ?? 0],
              ["eye", "Hidden listings", hidden ?? 0],
              ["users", "Banned users", banned ?? 0],
            ] as const
          ).map(([i, n, v]) => (
            <div key={n} className="panel stat">
              <Icon name={i} />
              <b>{v}</b>
              <span className="xs muted">{n}</span>
            </div>
          ))}
        </div>
        <div className="tbar">
          <nav className="seg" aria-label="Report status">
            {["open", "actioned", "dismissed", "all"].map((s) => (
              <Link key={s} href={link({ status: s })} aria-current={status === s ? "page" : undefined} style={{ flex: "1 0 auto", minHeight: 38, padding: "0 12px", borderRadius: 999, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: status === s ? "var(--brand-ink)" : "var(--ink-2)", background: status === s ? "var(--surface)" : undefined, boxShadow: status === s ? "var(--shr)" : undefined }}>
                {s[0].toUpperCase() + s.slice(1)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <caption className="vh">Reports</caption>
            <thead>
              <tr>
                <th scope="col">
                  <Link className={`thb on`} href={link({ sort: sort === "new" ? "old" : "new" })}>
                    Reported
                    <Icon name={sort === "new" ? "down" : "up"} className="icon i14" />
                  </Link>
                </th>
                <th scope="col">Reason</th>
                <th scope="col">About</th>
                <th scope="col">By</th>
                <th scope="col">Status</th>
                <th scope="col" className="r">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable @typescript-eslint/no-explicit-any -- joined PostgREST rows */}
              {(reports ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td className="faint">{ago(r.created_at)}</td>
                  <td>
                    <b className="sm">{REASON[r.reason] ?? r.reason}</b>
                    {r.details && <div className="xs muted" style={{ whiteSpace: "normal", maxWidth: 280 }}>{r.details}</div>}
                  </td>
                  <td>
                    {r.listing ? (
                      <Link href={`/item/${r.listing.id}`}>{r.listing.title}</Link>
                    ) : r.user ? (
                      <Link href={`/u/${r.user.id}`}>{r.user.name}</Link>
                    ) : (
                      <span className="faint">Message</span>
                    )}
                  </td>
                  <td>{r.reporter?.name ?? "Deleted user"}</td>
                  <td>
                    <span className={`st ${r.status === "open" ? "st-paused" : "st-active"}`}>{r.status}</span>
                  </td>
                  <td className="r">
                    <AdminButtons reportId={r.id} listingId={r.listing?.id ?? null} userId={r.user?.id ?? null} listingHidden={r.listing?.status === "hidden"} userBanned={Boolean(r.user?.banned)} status={r.status} />
                  </td>
                </tr>
              ))}
              {/* eslint-enable @typescript-eslint/no-explicit-any */}
              {!reports?.length && (
                <tr>
                  <td colSpan={6} className="faint" style={{ textAlign: "center", padding: 30 }}>
                    No reports here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
