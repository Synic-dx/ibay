/** FEATURE: One review: score pill, reason, tags, who and when. */
import { ago } from "@/lib/format";
import type { ReviewItem } from "./queries";

export function ReviewRow({ r }: { r: ReviewItem }) {
  return (
    <div className="review">
      <span className={`score ${r.score > 3 ? "s-good" : r.score < -3 ? "s-bad" : "s-mid"}`}>
        {r.score > 0 ? "+" : ""}
        {r.score}
      </span>
      <div className="sm" style={{ flex: 1 }}>
        <div>{r.reason}</div>
        {r.tags.length > 0 && (
          <div className="chips" style={{ marginTop: 6, gap: 4 }}>
            {r.tags.map((t) => (
              <span key={t} className="badge b-neutral">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="faint xs" style={{ marginTop: 4 }}>
          {r.raterName} · {ago(r.createdAt)}
        </div>
      </div>
    </div>
  );
}
