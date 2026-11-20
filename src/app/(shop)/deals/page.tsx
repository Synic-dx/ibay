/** FEATURE: /deals, every deal with its step tracker and ratings. */
import type { Metadata } from "next";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { listDeals } from "@/features/deals/queries";
import { DealsView } from "@/features/deals/deals-view";

export const metadata: Metadata = { title: "Your deals" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ tab?: string; dealId?: string }> }) {
  const viewer = await requireViewer("/deals");
  const { tab, dealId } = await searchParams;
  const deals = await listDeals(viewer.id);
  return (
    <>
      <SubBar title="Your deals" sub={`${deals.length} total`} />
      <main className="withtabs">
        <DealsView deals={deals} tab={tab ?? "all"} initialVerifyDealId={dealId} />
      </main>
    </>
  );
}
