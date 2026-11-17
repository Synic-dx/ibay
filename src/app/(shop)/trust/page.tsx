/** FEATURE: "How trust works": the Plume levels and the maths, in plain words. */
import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { Peacock } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "How trust works" };

export default async function TrustPage() {
  const me = await getViewer();
  return (
    <>
      <SubBar title="How trust works" sub="The Plume score" />
      <main className="withtabs">
        <div className="stack" style={{ gap: 14 }}>
          <div className="panel pad stack" style={{ gap: 8 }}>
            <div className="row">
              <Peacock size={40} />
              <h2>Plume, your campus karma</h2>
            </div>
            <p className="sm muted">
              Everyone starts at 0. After every deal, both people rate it from -10 to +10 and write why. New members move fast, people with many deals move slowly, so one bad review
              does not erase a good record.
            </p>
          </div>
          <div className="lgroup">
            {(
              [
                ["trophy", "Top rated", "150 and above", "t-good"],
                ["shield", "Trusted", "60 to 149", "t-good"],
                ["sparkles", "Building trust", "0 to 59", "t-new"],
                ["info", "Mixed reviews", "-1 to -59", "t-bad"],
                ["flag", "Flagged", "-60 or lower, listings hidden", "t-bad"],
              ] as const
            ).map(([i, a, b, c]) => (
              <div className="lrow" key={a}>
                <span className="li">
                  <Icon name={i} />
                </span>
                <span className="lt">
                  <b className={c}>{a}</b>
                  <span>{b}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="panel pad stack" style={{ gap: 6 }}>
            <span className="label">
              <Icon name="zap" />
              The maths
            </span>
            <span className="mono xs">Δ = K(n) × (rating / 10) × w(rater)</span>
            <span className="mono xs">K(n) = max(6, 40 / √(1 + n/3))</span>
            <span className="mono xs">w = clamp(1 + raterPlume/400, 0.5, 1.5)</span>
            <span className="xs faint">
              n is how many rated deals the person already has.{me ? ` You are at ${Math.round(me.plume)} with ${me.ratedDeals} deals.` : ""}
            </span>
          </div>
          <div className="panel pad stack" style={{ gap: 6 }}>
            <span className="label">
              <Icon name="shield" />
              Fair play
            </span>
            <ul className="bullets sm">
              <li>Only the two people in a finished deal can rate it, once each.</li>
              <li>Repeat ratings between the same two people within 30 days count half.</li>
              <li>A reason of at least 10 characters is required, and ratings can be edited for 24 hours.</li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
