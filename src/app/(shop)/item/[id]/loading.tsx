/** FEATURE: Loading skeleton for Item (shown instantly after a click). */
import { SkItem, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage className="withbar itempage" label="Loading item">
      <SkItem />
    </SkPage>
  );
}
