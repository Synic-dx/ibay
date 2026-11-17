/**
 * FEATURE: Category picture (tiles, stories, explore)
 * WHAT: The category's cover photo or artwork, or its icon when it has none.
 */
import { Icon } from "@/components/ui/icon";
import type { Category } from "@/features/shell/queries";

export function CategoryPic({ c }: { c: Pick<Category, "cover" | "coverFit" | "icon"> }) {
  if (c.cover) {
    // eslint-disable-next-line @next/next/no-img-element -- small local artwork
    return <img src={c.cover} alt="" className={c.coverFit === "cover" ? "cover" : ""} />;
  }
  return <Icon name={c.icon} className="icon i28" />;
}
