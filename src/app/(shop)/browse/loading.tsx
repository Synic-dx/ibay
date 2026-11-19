/** FEATURE: Loading skeleton for Browse (shown instantly after a click). */
import { SkChips, SkGrid, SkHeading, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading browse">
      <SkHeading />
      <SkChips />
      <SkGrid />
    </SkPage>
  );
}
