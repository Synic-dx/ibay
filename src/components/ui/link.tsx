"use client";
/**
 * FEATURE: App-wide <Link> (use this instead of next/link)
 * WHAT: Same as next/link, with two changes:
 *   1. Prefetch on hover/focus/touch, not on sight. Our pages are dynamic, so
 *      prefetching every visible link made the server render dozens of pages
 *      on each page load and slowed real clicks down (measured: 38 on Home).
 *   2. Tells the top progress bar when a click is waiting for the server.
 * Pass prefetch={false} or prefetch={true} to override.
 */
import NextLink, { useLinkStatus } from "next/link";
import { useEffect, useState, type ComponentProps } from "react";
import { navProgress } from "./nav-progress";

/** Lives inside each Link; reports "this click is still loading" to the progress bar. */
function PendingReporter() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    navProgress.start();
    return () => navProgress.stop();
  }, [pending]);
  return null;
}

type Props = ComponentProps<typeof NextLink>;

export default function Link({ prefetch, onMouseEnter, onFocus, onTouchStart, children, ...rest }: Props) {
  const [hot, setHot] = useState(false);
  // null = Next's normal prefetch, switched on only once the pointer comes near.
  const pf = prefetch !== undefined ? prefetch : hot ? null : false;
  return (
    <NextLink
      {...rest}
      prefetch={pf}
      onMouseEnter={(e) => {
        setHot(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setHot(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setHot(true);
        onTouchStart?.(e);
      }}
    >
      {children}
      <PendingReporter />
    </NextLink>
  );
}
