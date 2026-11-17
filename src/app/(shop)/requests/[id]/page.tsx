/**
 * FEATURE: One request with its offers [RUBRIC:CRUD-READ] [RUBRIC:CRUD-UPDATE] [RUBRIC:CRUD-DELETE]
 * WHAT: The request, "I have this" offers with photo and price, Accept /
 *       Message for the owner, and Edit / Found it / Delete for the owner.
 *       Repliers can edit or delete their own offer.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { ago, dayLabel, dayOffsetOf } from "@/lib/format";
import { getCategories } from "@/features/shell/queries";
import { getRequest } from "@/features/requests/queries";
import { OwnerBar, VoteButton } from "@/features/requests/request-ui";
import { ReplyActions, ReplyBar } from "@/features/requests/reply-actions";
import { TrustLine } from "@/features/listings/components/parts";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/requests/${id}`);
  const [res, categories] = await Promise.all([getRequest(id, viewer.id), getCategories()]);
  if (!res) notFound();
  const { request: r, replies } = res;
  const mine = r.author.id === viewer.id;
  const off = r.neededBy ? dayOffsetOf(r.neededBy) : null;
  const cats = categories.filter((c) => c.id !== "food").map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <SubBar title="Request" sub={categories.find((c) => c.id === r.categoryId)?.short} backHref="/requests" />
      <main className="withbar">
        <div className="panel rq">
          <VoteButton id={r.id} votes={r.votes} voted={r.voted} />
          <div style={{ flex: 1 }} className="stack">
            <span className="row xs faint">
              <Avatar name={r.author.name} url={r.author.avatarUrl} color={r.author.avatarColor} size={20} />
              {r.author.name} · {ago(r.createdAt)}
            </span>
            <h1 style={{ fontSize: 19 }}>{r.text}</h1>
            <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {off != null && (
                <span className={`badge ${off <= 2 ? "b-drop" : "b-neutral"}`}>
                  <Icon name="cal" />
                  By {dayLabel(Math.max(0, off), true)}
                </span>
              )}
              <span className="badge b-neutral">
                <Icon name="rupee" />
                {r.budget}
              </span>
              {r.status === "found" && <span className="badge b-near">Found</span>}
            </span>
            {mine && <OwnerBar id={r.id} status={r.status} categories={cats} initial={{ text: r.text, categoryId: r.categoryId as never, budget: r.budget, neededBy: r.neededBy ?? "" }} />}
          </div>
        </div>
        <div className="sh" style={{ marginTop: 20 }}>
          <h2>
            <Icon name="chat" />
            {replies.length} offer{replies.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {replies.map((o) => (
            <div key={o.id} className="panel pad row" style={{ alignItems: "flex-start", gap: 12 }}>
              <div className="ph" style={{ width: 84, borderRadius: 12, flex: "none" }}>
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- reply photo
                  <img src={o.imageUrl} alt={`Photo from ${o.author.name}`} className={o.imageUrl.startsWith("/img/") ? "" : "cover"} />
                ) : (
                  <Icon name="img" className="icon i28" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }} className="stack">
                <span className="row sm">
                  <Avatar name={o.author.name} url={o.author.avatarUrl} color={o.author.avatarColor} size={22} />
                  <b>{o.author.name.split(" ")[0]}</b>
                  <TrustLine plume={o.author.plume} ratedDeals={o.author.ratedDeals} deals={false} />
                </span>
                <span className="sm">{o.text}</span>
                <b>{o.priceText}</b>
                {o.accepted && <span className="badge b-near" style={{ alignSelf: "flex-start" }}>Accepted</span>}
                <ReplyActions replyId={o.id} mineReply={o.author.id === viewer.id} mineRequest={mine} authorId={o.author.id} text={o.text} priceText={o.priceText} requestText={r.text} />
              </div>
            </div>
          ))}
          {!replies.length && (
            <div className="empty">
              <span className="ei">
                <Icon name="chat" />
              </span>
              <h3>No offers yet</h3>
              <p className="sm">{mine ? "You will be notified when someone replies." : "Be the first to reply."}</p>
            </div>
          )}
        </div>
      </main>
      {!mine && r.status === "open" && <ReplyBar requestId={r.id} requestText={r.text} />}
    </>
  );
}
