"use client";
/**
 * FEATURE: Link into the requests board (guests get the sign-in modal)
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useApp } from "@/components/app-context";

export function RequestLink({ href, className, style, children }: { href: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const { viewer, openAuth } = useApp();
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={(e) => {
        if (!viewer) {
          e.preventDefault();
          openAuth({ reason: "Sign in to see and reply to requests", next: href });
        }
      }}
    >
      {children}
    </Link>
  );
}
