/** FEATURE: Loading skeleton for Trust (shown instantly after a click). */
import { Sk, SkHeading, SkPage, SkStats } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading Plume">
      <SkHeading />
      <SkStats n={3} />
      <div className="skp">
        {Array.from({ length: 6 }, (_, i) => (
          <Sk key={i} className="line" w={i % 3 === 2 ? "60%" : undefined} />
        ))}
      </div>
    </SkPage>
  );
}
