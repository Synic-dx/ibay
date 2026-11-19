/** FEATURE: Loading skeleton for Search (shown instantly after a click). */
import { SkChips, SkGrid, SkHeading, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage className="" label="Loading search">
      <SkHeading sub={false} />
      <SkChips />
      <SkGrid />
    </SkPage>
  );
}
