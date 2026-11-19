/** FEATURE: Loading skeleton for Messages (shown instantly after a click). */
import { SkHeading, SkList, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading messages">
      <SkHeading sub={false} />
      <SkList n={8} />
    </SkPage>
  );
}
