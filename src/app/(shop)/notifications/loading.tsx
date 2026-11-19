/** FEATURE: Loading skeleton for Notifications (shown instantly after a click). */
import { SkHeading, SkList, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading notifications">
      <SkHeading sub={false} />
      <SkList n={8} avatar={40} />
    </SkPage>
  );
}
