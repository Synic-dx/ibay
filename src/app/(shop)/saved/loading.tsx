/** FEATURE: Loading skeleton for Saved (shown instantly after a click). */
import { SkGrid, SkHeading, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading saved">
      <SkHeading />
      <SkGrid n={8} />
    </SkPage>
  );
}
