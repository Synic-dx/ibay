/**
 * FEATURE: Desktop footer (hidden on phones, like the prototype)
 */
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";
import { Peacock, Wordmark } from "@/components/brand";

const COLS: [string, [string, string][]][] = [
  ["Shop", [["Preprocess Store", "/browse?cat=preprocess"], ["Gym Corner", "/browse?cat=gym"], ["Gadgets", "/browse?cat=gadgets"], ["Manga & novels", "/browse?cat=reads"], ["All categories", "/explore"]]],
  ["Sell", [["List an item", "/sell"], ["Start an auction", "/sell?mode=auction"], ["Rent something out", "/sell?mode=rent"], ["Food drop", "/sell?mode=drop"]]],
  ["Help", [["How trust works", "/trust"], ["Requests board", "/requests"], ["My listings", "/my-listings"], ["Icons by Lucide (ISC licence)", "https://lucide.dev/license"]]],
];

export function Footer() {
  return (
    <footer className="dfoot">
      <div className="dh-in">
        <div className="dfcols">
          <div className="dfabout">
            <div className="row">
              <Peacock size={34} />
              <Wordmark size={26} />
            </div>
            <p>IIM Indore&apos;s own campus marketplace. Buy, rent, bid or give away, with people from your own hostel.</p>
            <span className="xs">
              <Icon name="shield" className="icon i14" /> Only verified @iimidr.ac.in accounts
            </span>
          </div>
          {COLS.map(([t, items]) => (
            <div key={t}>
              <h4>{t}</h4>
              {items.map(([n, href]) => (
                <Link key={n} href={href}>
                  {n}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="dfbot">
          <span>© 2026 i-bay · a student project at IIM Indore</span>
          <span>Pay at handover by UPI or cash. Nothing is charged online.</span>
        </div>
      </div>
    </footer>
  );
}
