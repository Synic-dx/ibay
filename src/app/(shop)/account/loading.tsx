/** FEATURE: Loading skeleton for Account (shown instantly after a click). */
import { Sk, SkHeading, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage className="withtabs formpage" label="Loading account">
      <SkHeading />
      <div className="skp" style={{ gap: 16 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skp" style={{ gap: 8 }}>
            <Sk w={120} h={12} />
            <Sk h={i === 2 ? 110 : 48} r={14} />
          </div>
        ))}
      </div>
    </SkPage>
  );
}
