/**
 * FEATURE: 404 page. Also shown when you open someone else's edit page,
 * so listing ids can't be probed.
 */
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";

export default function NotFound() {
  return (
    <main>
      <div className="empty">
        <span className="ei">
          <Icon name="pkg" />
        </span>
        <h3>Not found</h3>
        <p className="sm">It may have been removed, or the link is wrong.</p>
        <Link className="btn" href="/">
          Back to the store
        </Link>
      </div>
    </main>
  );
}
