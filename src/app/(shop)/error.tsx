"use client";
/**
 * FEATURE: Friendly error page for the shop (no stack traces shown to users).
 */
import { useEffect } from "react";
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[i-bay] page error", error.digest ?? error.message);
  }, [error]);
  return (
    <main>
      <div className="empty">
        <span className="ei">
          <Icon name="alert" />
        </span>
        <h3>Something went wrong</h3>
        <p className="sm">It is on our side. Try again, or head back to the store.</p>
        <div className="row">
          <button type="button" className="btn" onClick={reset}>
            Try again
          </button>
          <Link className="btn sec" href="/">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
