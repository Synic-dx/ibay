/**
 * FEATURE: /my-listings, the seller dashboard [RUBRIC:CRUD-READ] [RUBRIC:DATA-DISPLAY]
 * WHAT: Stat tiles (live listings, total views, saves, offers waiting, earned
 *       this month), quick "list" chips, the listings table and requests you
 *       could fulfil.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { fmt } from "@/lib/format";
import { trustLevel } from "@/lib/plume";
import { getCategories } from "@/features/shell/queries";
import { guardInfo, myListings, myStats, parseMy } from "@/features/listings/my-queries";
import { MyListingsTable } from "@/features/listings/my-listings-table";
import { listRequests } from "@/features/requests/queries";

export const metadata: Metadata = { title: "My listings" };

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer("/my-listings");
  const params = parseMy(await searchParams);
  const [{ rows, total, counts }, stats, categories, requests] = await Promise.all([
    myListings(viewer.id, params),
    myStats(viewer.id),
    getCategories(),
    listRequests("urgent", viewer.id, 10),
  ]);
  const guards = await guardInfo(rows.map((r) => r.id));
  const tiles: [string, string, string | number, string | null][] = [
    ["store", "Live listings", stats.live, "/my-listings"],
    ["eye", "Total views", stats.views, null],
    ["heart", "Saves", stats.saves, null],
    ["tag", "Offers waiting", stats.offers, "/messages"],
    ["wallet", "Earned this month", fmt(stats.earned), "/deals"],
  ];

  return (
    <>
      <SubBar title="My listings" sub={trustLevel(viewer.plume, viewer.ratedDeals).label} />
      <main className="withtabs">
        <div className="g2 stats4">
          {tiles.map(([i, n, v, href]) =>
            href ? (
              <Link key={n} className="panel stat" href={href}>
                <Icon name={i} />
                <b>{v}</b>
                <span className="xs muted">{n}</span>
              </Link>
            ) : (
              <div key={n} className="panel stat">
                <Icon name={i} />
                <b>{v}</b>
                <span className="xs muted">{n}</span>
              </div>
            ),
          )}
        </div>
        <div className="chiprow" style={{ marginTop: 14 }}>
          {(
            [
              ["sell", "List an item", "plus"],
              ["drop", "Food drop", "flame"],
              ["auction", "Start an auction", "hammer"],
              ["rent", "Rent something out", "repeat"],
            ] as const
          ).map(([m, n, i]) => (
            <Link key={m} className="chip" href={`/sell?mode=${m}`}>
              <Icon name={i} />
              {n}
            </Link>
          ))}
        </div>
        <MyListingsTable rows={rows} total={total} counts={counts} params={params} guards={guards} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

        <div className="sh" style={{ marginTop: 22 }}>
          <h2>
            <Icon name="list" />
            Requests you could fulfil
          </h2>
          <Link href="/requests">
            All
            <Icon name="chev" />
          </Link>
        </div>
        <div className="lgroup">
          {requests
            .filter((r) => r.author.id !== viewer.id)
            .slice(0, 3)
            .map((r) => (
              <Link key={r.id} className="lrow" href={`/requests/${r.id}`}>
                <Avatar name={r.author.name} url={r.author.avatarUrl} color={r.author.avatarColor} size={36} />
                <span className="lt">
                  <b>{r.text}</b>
                  <span>
                    {r.budget} · {r.votes} need this
                  </span>
                </span>
                <Icon name="chev" />
              </Link>
            ))}
        </div>
      </main>
    </>
  );
}
