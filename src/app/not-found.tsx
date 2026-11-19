/** Root 404 (outside the shop layout). */
import Link from "@/components/ui/link";

export default function RootNotFound() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", textAlign: "center", gap: 12 }}>
      <div>
        <h1>Not found</h1>
        <p className="muted">That page doesn&apos;t exist.</p>
        <Link className="btn" href="/" style={{ marginTop: 12 }}>
          Back to i-bay
        </Link>
      </div>
    </main>
  );
}
