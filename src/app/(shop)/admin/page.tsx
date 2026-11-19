/**
 * FEATURE: /admin, moderation [RUBRIC:DATA-DISPLAY]
 * WHAT: Three tabs.
 *   Reports  - filter by status, sort newest / oldest, hide listing, ban user, resolve.
 *   Listings - every listing (search, filter by status): edit, hide, delete, restore.
 *   Users    - every account (search by name or email): ban / unban, delete account.
 *   Plus a CAPTCHA dashboard (pass/fail in the last 24 hours).
 * WHO: admins only; everyone else gets a 404. Every action checks the role again on the server.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { ago, fmt } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/validation/market";
import { AdminButtons } from "@/features/admin/admin-buttons";
import { ListingRowActions, UserRowActions } from "@/features/admin/admin-rows";

export const metadata: Metadata = { title: "Admin" };

const REASON = Object.fromEntries(REPORT_REASONS);
const TABS = [
  ["reports", "Reports", "flag"],
  ["listings", "Listings", "tag"],
  ["users", "Users", "users"],
] as const;
const LISTING_STATUSES = ["all", "active", "paused", "hidden", "sold", "deleted"] as const;
const PAGE = 50;

type Params = { tab?: string; status?: string; sort?: string; q?: string; page?: string };

/** ISO time 24 hours ago (for the CAPTCHA dashboard). */
const dayAgo = () => new Date(Date.now() - 864e5).toISOString();

/** Search text that is safe inside a PostgREST ilike / or() filter. */
const cleanQuery = (q: string) => q.replace(/[%_,()*\\]/g, " ").trim().slice(0, 60);

const pill = (on: boolean) =>
  ({
    flex: "1 0 auto",
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    color: on ? "var(--brand-ink)" : "var(--ink-2)",
    background: on ? "var(--surface)" : undefined,
    boxShadow: on ? "var(--shr)" : undefined,
  }) as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "admin") notFound();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "reports";

  const since = dayAgo();
  const [{ count: openReports }, { count: capOk }, { count: capFail }, { count: hidden }, { count: banned }] = await Promise.all([
    db().from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db().from("captcha_logs").select("id", { count: "exact", head: true }).eq("success", true).gt("created_at", since),
    db().from("captcha_logs").select("id", { count: "exact", head: true }).eq("success", false).gt("created_at", since),
    db().from("listings").select("id", { count: "exact", head: true }).eq("status", "hidden"),
    db().from("profiles").select("id", { count: "exact", head: true }).eq("banned", true),
  ]);

  return (
    <>
      <SubBar title="Admin" sub="Reports, listings and people" />
      <main className="withtabs">
        <div className="g2 stats4">
          {(
            [
              ["flag", "Open reports", openReports ?? 0],
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
          <nav className="seg" aria-label="Admin sections">
            {TABS.map(([k, n, i]) => (
              <Link key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined} style={pill(tab === k)}>
                <Icon name={i} className="icon i14" />
                {n}
              </Link>
            ))}
          </nav>
        </div>

        {tab === "reports" && <ReportsTab sp={sp} />}
        {tab === "listings" && <ListingsTab sp={sp} />}
        {tab === "users" && <UsersTab sp={sp} />}
      </main>
    </>
  );
}

/** Search box that keeps the current tab and filter. */
function SearchBox({ tab, q, placeholder, keep }: { tab: string; q: string; placeholder: string; keep?: Record<string, string> }) {
  return (
    <form method="get" action="/admin" role="search" className="row" style={{ gap: 8, margin: "12px 0" }}>
      <input type="hidden" name="tab" value={tab} />
      {Object.entries(keep ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="iwrap" style={{ flex: 1 }}>
        <Icon name="search" className="icon i18" />
        <input className="input" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} maxLength={60} />
      </div>
      <button className="btn sec" type="submit">
        Search
      </button>
    </form>
  );
}

/** Previous / next page links. */
function Pager({ base, page, hasMore }: { base: Record<string, string>; page: number; hasMore: boolean }) {
  if (page === 1 && !hasMore) return null;
  const href = (p: number) => `/admin?${new URLSearchParams({ ...base, page: String(p) })}`;
  return (
    <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
      {page > 1 && (
        <Link className="btn sec small" href={href(page - 1)}>
          <Icon name="back" />
          Previous
        </Link>
      )}
      <span className="sm muted" style={{ alignSelf: "center" }}>
        Page {page}
      </span>
      {hasMore && (
        <Link className="btn sec small" href={href(page + 1)}>
          Next
          <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}

async function ReportsTab({ sp }: { sp: Params }) {
  const status = ["open", "actioned", "dismissed", "all"].includes(sp.status ?? "") ? sp.status! : "open";
  const sort = sp.sort === "old" ? "old" : "new";
  let q = db()
    .from("reports")
    .select("id,reason,details,status,created_at,listing_id,reported_user_id,reporter:profiles!reports_reporter_id_fkey(name),listing:listings(id,title,status),user:profiles!reports_reported_user_id_fkey(id,name,banned)")
    .order("created_at", { ascending: sort === "old" })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  const { data: reports } = await q;
  const link = (patch: Record<string, string>) => `/admin?${new URLSearchParams({ tab: "reports", status, sort, ...patch })}`;

  return (
    <>
      <div className="tbar">
        <nav className="seg" aria-label="Report status">
          {["open", "actioned", "dismissed", "all"].map((s) => (
            <Link key={s} href={link({ status: s })} aria-current={status === s ? "page" : undefined} style={pill(status === s)}>
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
    </>
  );
}

async function ListingsTab({ sp }: { sp: Params }) {
  const status = (LISTING_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "all";
  const q = cleanQuery(sp.q ?? "");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  let query = db()
    .from("listings")
    .select("id,title,mode,price,rent_unit,status,created_at,seller:profiles!listings_seller_id_fkey(id,name)")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE); // one extra row tells us if there's a next page
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data, error } = await query;
  const rows = (data ?? []).slice(0, PAGE);
  const base = { tab: "listings", status, ...(q ? { q } : {}) };
  const link = (s: string) => `/admin?${new URLSearchParams({ ...base, status: s })}`;

  return (
    <>
      <SearchBox tab="listings" q={q} placeholder="Search listing titles" keep={{ status }} />
      <div className="tbar">
        <nav className="seg" aria-label="Listing status" style={{ overflowX: "auto" }}>
          {LISTING_STATUSES.map((s) => (
            <Link key={s} href={link(s)} aria-current={status === s ? "page" : undefined} style={pill(status === s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <caption className="vh">Listings</caption>
          <thead>
            <tr>
              <th scope="col">Listing</th>
              <th scope="col">Seller</th>
              <th scope="col">Type</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              <th scope="col">Listed</th>
              <th scope="col" className="r">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable @typescript-eslint/no-explicit-any -- joined PostgREST rows */}
            {rows.map((l: any) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "normal", maxWidth: 300 }}>
                  {l.status === "deleted" ? <span>{l.title}</span> : <Link href={`/item/${l.id}`}>{l.title}</Link>}
                </td>
                <td>{l.seller ? <Link href={`/u/${l.seller.id}`}>{l.seller.name}</Link> : <span className="faint">Deleted user</span>}</td>
                <td className="sm">{l.mode === "sell" ? "Buy" : l.mode === "rent" ? "Rent" : l.mode === "auction" ? "Auction" : "Food drop"}</td>
                <td className="sm">
                  {fmt(l.price)}
                  {l.mode === "rent" && l.rent_unit ? <span className="faint">/{l.rent_unit}</span> : null}
                </td>
                <td>
                  <span className={`st ${l.status === "active" ? "st-active" : "st-paused"}`}>{l.status}</span>
                </td>
                <td className="faint">{ago(l.created_at)}</td>
                <td className="r">
                  <ListingRowActions id={l.id} title={l.title} status={l.status} />
                </td>
              </tr>
            ))}
            {/* eslint-enable @typescript-eslint/no-explicit-any */}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="faint" style={{ textAlign: "center", padding: 30 }}>
                  {error ? "Couldn't load listings. Refresh to try again." : "No listings match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager base={base} page={page} hasMore={(data ?? []).length > PAGE} />
    </>
  );
}

async function UsersTab({ sp }: { sp: Params }) {
  const q = cleanQuery(sp.q ?? "");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  let query = db()
    .from("profiles")
    .select("id,name,email,hostel,role,banned,created_at,listings:listings!listings_seller_id_fkey(count)")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, error } = await query;
  const rows = (data ?? []).slice(0, PAGE);
  const base = { tab: "users", ...(q ? { q } : {}) };

  return (
    <>
      <SearchBox tab="users" q={q} placeholder="Search by name or email" />
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <caption className="vh">Users</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Hostel</th>
              <th scope="col">Listings</th>
              <th scope="col">Joined</th>
              <th scope="col">Status</th>
              <th scope="col" className="r">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable @typescript-eslint/no-explicit-any -- joined PostgREST rows */}
            {rows.map((u: any) => {
              const n = Number(u.listings?.[0]?.count ?? 0);
              return (
                <tr key={u.id}>
                  <td>
                    <Link href={`/u/${u.id}`}>{u.name}</Link>
                    {u.role === "admin" && <span className="xs faint"> · admin</span>}
                  </td>
                  <td className="sm">{u.email}</td>
                  <td className="sm">{u.hostel}</td>
                  <td className="sm">{n}</td>
                  <td className="faint">{ago(u.created_at)}</td>
                  <td>
                    <span className={`st ${u.banned ? "st-paused" : "st-active"}`}>{u.banned ? "banned" : "active"}</span>
                  </td>
                  <td className="r">
                    <UserRowActions id={u.id} name={u.name} banned={Boolean(u.banned)} isAdmin={u.role === "admin"} listings={n} />
                  </td>
                </tr>
              );
            })}
            {/* eslint-enable @typescript-eslint/no-explicit-any */}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="faint" style={{ textAlign: "center", padding: 30 }}>
                  {error ? "Couldn't load people. Refresh to try again." : "Nobody matches."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager base={base} page={page} hasMore={(data ?? []).length > PAGE} />
    </>
  );
}
