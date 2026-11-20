/**
 * FEATURE: One chat, full screen [RUBRIC:EXTRA]
 * WHO: only the two members; anyone else gets a 404.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { getThread } from "@/features/chat/queries";
import { ThreadView } from "@/features/chat/thread-view";
import { TrustLine } from "@/features/listings/components/parts";
import { ReportButton } from "@/features/admin/report-sheet";

export const metadata: Metadata = { title: "Chat" };

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ deal?: string }>;
}) {
  const { id } = await params;
  const { deal } = (await searchParams) ?? {};
  const viewer = await requireViewer(`/messages/${id}`);
  const t = await getThread(id, viewer.id, deal);
  if (!t) notFound();
  return (
    <>
      <SubBar
        backHref="/messages"
        title={
          <Link href={`/u/${t.other.id}`} className="row plain" style={{ minWidth: 0 }}>
            <Avatar name={t.other.name} url={t.other.avatarUrl} color={t.other.avatarColor} size={34} />
            <span style={{ minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 15 }}>{t.other.name}</b>
              <span className="xs" style={{ fontWeight: 500 }}>
                <TrustLine plume={t.other.plume} ratedDeals={t.other.ratedDeals} deals={false} /> <span className="faint">· {t.other.hostel}</span>
              </span>
            </span>
          </Link>
        }
        actions={<ReportButton userId={t.other.id} label="Report this person" compact />}
      />
      <main className="chatpage" style={{ padding: "0 0 calc(150px + var(--safe-b))" }}>
        <ThreadView initial={t} />
      </main>
    </>
  );
}
