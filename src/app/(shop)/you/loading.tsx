/** FEATURE: Loading skeleton for Your profile (shown instantly after a click). */
import { SkList, SkPage, SkProfileHead, SkStats } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading your profile">
      <SkProfileHead />
      <SkStats n={4} />
      <SkList n={5} avatar={36} round={false} />
    </SkPage>
  );
}
