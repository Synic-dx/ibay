/** FEATURE: Loading skeleton for Home (shown instantly after a click). */
import { Sk, SkChips, SkGrid, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage label="Loading home">
      <SkChips n={8} />
      <Sk h={260} r={24} style={{ marginBottom: 20 }} />
      <SkGrid n={10} />
    </SkPage>
  );
}
