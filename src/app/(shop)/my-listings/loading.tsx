/** FEATURE: Loading skeleton for My listings (shown instantly after a click). */
import { SkHeading, SkList, SkPage, SkStats } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading my listings">
      <SkHeading />
      <SkStats n={5} />
      <SkList n={6} avatar={56} round={false} />
    </SkPage>
  );
}
