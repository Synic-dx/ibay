/**
 * FEATURE: Explore (every category, grouped by what is going on on campus)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { RootBar, SearchPill } from "@/components/shell/mobile-bars";
import { CategoryPic } from "@/features/home/category-pic";
import { GROUP_ICON, GROUPS, getCategories, getCollections } from "@/features/shell/queries";
import { RequestLink } from "@/features/requests/request-link";

export const metadata: Metadata = { title: "Explore" };

const COLL_ICON: Record<string, string> = { starter: "bed", moveout: "pkg", placement: "shirt" };

export default async function ExplorePage() {
  const [categories, collections] = await Promise.all([getCategories(), getCollections()]);
  return (
    <>
      <RootBar>
        <div style={{ paddingTop: 4 }}>
          <SearchPill placeholder="Search all of i-bay" />
        </div>
      </RootBar>
      <main className="withtabs">
        <h1 style={{ marginTop: 4 }}>Explore</h1>
        <p className="muted sm">Every category on campus, grouped by what is going on.</p>
        {GROUPS.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`}>
            <h2 className="grp" id={`g-${g}`}>
              <Icon name={GROUP_ICON[g]} />
              {g}
            </h2>
            <div className="tiles">
              {categories
                .filter((c) => c.group === g)
                .map((c) => (
                  <Link key={c.id} className="tile" href={`/browse?cat=${c.id}`}>
                    <span className="ci">
                      <CategoryPic c={c} />
                    </span>
                    {c.short}
                  </Link>
                ))}
            </div>
          </section>
        ))}
        <h2 className="grp">
          <Icon name="sparkles" />
          Collections
        </h2>
        <div className="lgroup">
          {collections.map((c) => (
            <Link key={c.id} className="lrow" href={`/browse?coll=${c.id}`}>
              <span className="li">
                <Icon name={COLL_ICON[c.id] ?? "party"} />
              </span>
              <span className="lt">
                <b>{c.name}</b>
                <span>{c.description}</span>
              </span>
              <Icon name="chev" />
            </Link>
          ))}
        </div>
        <RequestLink href="/requests?new=1" className="panel pad row" style={{ marginTop: 18, width: "100%", textAlign: "left" }}>
          <span className="li" style={{ width: 44, height: 44, borderRadius: 14, background: "var(--mint-soft)", display: "grid", placeItems: "center", color: "var(--mint-ink)" }}>
            <Icon name="list" />
          </span>
          <span style={{ flex: 1 }}>
            <b>Can&apos;t find it?</b>
            <br />
            <span className="sm muted">Post &quot;I am looking for a...&quot; and people reply with photos</span>
          </span>
          <Icon name="chev" />
        </RequestLink>
      </main>
    </>
  );
}
