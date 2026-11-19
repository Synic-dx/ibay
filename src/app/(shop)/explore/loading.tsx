/** FEATURE: Loading skeleton for Explore (shown instantly after a click). */
import { SkChips, SkGrid, SkHeading, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading explore">
      <SkHeading />
      <SkChips />
      <SkGrid />
    </SkPage>
  );
}
