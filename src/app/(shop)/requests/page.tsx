/**
 * FEATURE: Requests board [RUBRIC:DATA-DISPLAY] [RUBRIC:CRUD-READ]
 * WHAT: Post "I am looking for a...", sort by soonest needed / newest / most
 *       needed, upvote "need it", see how many offers each has.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { ago, dayLabel, dayOffsetOf } from "@/lib/format";
import { getCategories } from "@/features/shell/queries";
import { listRequests, myRequests } from "@/features/requests/queries";
import { NewRequestButton, VoteButton } from "@/features/requests/request-ui";

export const metadata: Metadata = { title: "Looking for" };

const SORTS: [string, string, string][] = [
  ["urgent", "Soonest", "clock"],
  ["new", "Newest", "sparkles"],
  ["top", "Most needed", "flame"],
  ["mine", "Mine", "user"],
];

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ sort?: string; new?: string; text?: string }> }) {
  const viewer = await requireViewer("/requests");
  const sp = await searchParams;
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : "urgent";
  const [list, categories] = await Promise.all([sort === "mine" ? myRequests(viewer.id) : listRequests(sort, viewer.id), getCategories()]);
  const catName = new Map(categories.map((c) => [c.id, c.short]));
  return (
    <>
      <SubBar title="Looking for..." sub="Requests from campus" />
      <main className="withtabs">
        <NewRequestButton categories={categories.filter((c) => c.id !== "food").map((c) => ({ id: c.id, name: c.name }))} autoOpen={sp.new === "1"} initialText={sp.text} />
        <nav className="seg" style={{ margin: "14px 0" }} aria-label="Sort requests">
          {SORTS.map(([k, n, i]) => (
            <Link key={k} href={`/requests?sort=${k}`} className={sort === k ? "on" : ""} aria-current={sort === k ? "page" : undefined} style={{ flex: 1, minHeight: 38, borderRadius: 999, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: sort === k ? "var(--brand-ink)" : "var(--ink-2)", background: sort === k ? "var(--surface)" : undefined, boxShadow: sort === k ? "var(--shr)" : undefined }}>
              <Icon name={i} className="icon i16" />
              {n}
            </Link>
          ))}
        </nav>
        <div className="stack" style={{ gap: 12 }}>
          {list.map((r) => {
            const off = r.neededBy ? dayOffsetOf(r.neededBy) : null;
            return (
              <div className="panel rq" key={r.id}>
                <VoteButton id={r.id} votes={r.votes} voted={r.voted} />
                <Link href={`/requests/${r.id}`} className="plain" style={{ flex: 1, minWidth: 0, textAlign: "left", display: "flex", flexDirection: "column", gap: 6 }}>
                  <b style={{ fontSize: 14.5, lineHeight: 1.3 }}>{r.text}</b>
                  <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {off != null && (
                      <span className={`badge ${off <= 2 ? "b-drop" : "b-neutral"}`}>
                        <Icon name="cal" />
                        By {dayLabel(Math.max(0, off), true)}
                      </span>
                    )}
                    <span className="badge b-neutral">{catName.get(r.categoryId) ?? r.categoryId}</span>
                    {r.status === "found" && <span className="badge b-near">Found</span>}
                  </span>
                  <span className="xs muted">{r.budget}</span>
                  <span className="row xs faint">
                    <Avatar name={r.author.name} url={r.author.avatarUrl} color={r.author.avatarColor} size={18} />
                    {r.author.name.split(" ")[0]} · {r.author.hostel} · {ago(r.createdAt)}
                  </span>
                  <span className="between">
                    <span className={`sm ${r.replyCount ? "" : "faint"}`}>
                      <Icon name="chat" className="icon i14" /> {r.replyCount} offer{r.replyCount === 1 ? "" : "s"}
                    </span>
                    <span className="sm" style={{ color: "var(--brand-ink)", fontWeight: 600 }}>
                      {r.author.id === viewer.id ? "View" : "I have this"} ›
                    </span>
                  </span>
                </Link>
              </div>
            );
          })}
          {!list.length && (
            <div className="empty">
              <span className="ei">
                <Icon name="list" />
              </span>
              <h3>{sort === "mine" ? "You haven't asked for anything yet" : "No open requests"}</h3>
              <p className="sm">Post what you need and people who have it can reply.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
