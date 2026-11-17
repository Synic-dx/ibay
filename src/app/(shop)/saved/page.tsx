/** FEATURE: Saved items (hearted listings; you get price-drop alerts for them). */
import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { cardsByIds } from "@/features/listings/queries";
import { ProductCard } from "@/features/listings/components/product-card";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const viewer = await requireViewer("/saved");
  const { data } = await db().from("saved_items").select("listing_id").eq("user_id", viewer.id).order("created_at", { ascending: false });
  const items = (await cardsByIds((data ?? []).map((r) => r.listing_id), viewer.id)).filter((l) => l.status === "active" && !l.deletedAt);
  return (
    <>
      <SubBar title="Saved" sub={`${items.length} items`} />
      <main className="withtabs">
        {items.length ? (
          <div className="g2">
            {items.map((l) => (
              <ProductCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="ei">
              <Icon name="heart" />
            </span>
            <h3>Nothing saved yet</h3>
            <p className="sm">Tap the heart on any item to keep it here and get price drop alerts.</p>
          </div>
        )}
      </main>
    </>
  );
}
