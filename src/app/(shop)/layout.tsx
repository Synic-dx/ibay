/**
 * FEATURE: Shop layout (every page except /login)
 * WHAT: Desktop header + category bar + LIVE ticker, the page, the footer,
 *       the phone tab bar and drawer, the sign-in modal, the messaging dock
 *       and Mayu. Pages render their own phone top bar (RootBar or SubBar).
 */
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/session";
import { getCategories, getCollections, getLiveItems } from "@/features/shell/queries";
import { DesktopHeader } from "@/components/shell/desktop-header";
import { Footer } from "@/components/shell/footer";
import { TabBar } from "@/components/shell/mobile-bars";
import { Drawer } from "@/components/shell/drawer";
import { AuthModal } from "@/features/auth/auth-modal";
import { MessagingDock } from "@/features/chat/dock";
import { MayuLauncher } from "@/features/mayu/mayu-sheet";
import { RealtimePings } from "@/features/chat/realtime-pings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const [categories, collections, live] = await Promise.all([getCategories(), getCollections(), getLiveItems(viewer)]);
  return (
    <div id="shell">
      <Suspense fallback={<div className="dh" style={{ height: 122 }} />}>
        <DesktopHeader categories={categories} collections={collections} drops={live.drops} auctions={live.auctions} />
      </Suspense>
      {children}
      <Footer />
      <Suspense>
        <TabBar />
        <Drawer categories={categories} liveDrops={live.drops.length} />
        <AuthModal />
      </Suspense>
      <MessagingDock />
      <MayuLauncher />
      <RealtimePings />
    </div>
  );
}
