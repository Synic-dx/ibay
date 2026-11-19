/** FEATURE: Loading skeleton for Deals (shown instantly after a click). */
import { SkChips, SkHeading, SkList, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading deals">
      <SkHeading />
      <SkChips n={4} />
      <SkList n={5} avatar={56} round={false} />
    </SkPage>
  );
}
