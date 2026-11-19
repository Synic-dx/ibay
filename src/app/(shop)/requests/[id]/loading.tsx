/** FEATURE: Loading skeleton for Request (shown instantly after a click). */
import { Sk, SkHeading, SkList, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage className="withbar" label="Loading request">
      <SkHeading />
      <Sk h={120} r={18} style={{ marginBottom: 16 }} />
      <SkList n={3} />
    </SkPage>
  );
}
