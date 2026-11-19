/** FEATURE: Loading skeleton for Profile (shown instantly after a click). */
import { SkGrid, SkPage, SkProfileHead, SkStats } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading profile">
      <SkProfileHead />
      <SkStats n={3} />
      <SkGrid n={8} />
    </SkPage>
  );
}
