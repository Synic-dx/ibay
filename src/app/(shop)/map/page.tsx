import type { Metadata } from "next";
import { getViewer } from "@/lib/auth/session";
import { dbReady } from "@/lib/supabase/server";
import { visibleCatalogue } from "@/features/listings/queries";
import CampusBrowseMap from "@/features/map/components/campus-browse-map";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campus Map · i-bay",
  description: "Explore active listings, food drops, and rentals across IIM Indore student residences on an interactive 3D campus map.",
};

export default async function CampusMapPage() {
  if (!dbReady()) return <SetupNotice />;
  const viewer = await getViewer();
  const listings = await visibleCatalogue(viewer);

  return (
    <main style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <CampusBrowseMap listings={listings} />
    </main>
  );
}

