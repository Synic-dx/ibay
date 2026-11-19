/** FEATURE: Loading skeleton for Admin (shown instantly after a click). */
import { SkHeading, SkList, SkPage, SkStats } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading admin">
      <SkHeading />
      <SkStats n={4} />
      <SkList n={8} avatar={36} round={false} />
    </SkPage>
  );
}
