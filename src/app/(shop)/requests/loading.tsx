/** FEATURE: Loading skeleton for Requests (shown instantly after a click). */
import { SkChips, SkHeading, SkList, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading requests">
      <SkHeading />
      <SkChips n={4} />
      <SkList n={7} avatar={48} round={false} />
    </SkPage>
  );
}
