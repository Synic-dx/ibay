"use client";
/**
 * FEATURE: Light / dark toggle (always visible, top right, every screen size)
 * WHAT: next-themes sets data-theme on <html> before paint, so there is no flash.
 */
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

export function ThemeToggle({
  className = "ib thm",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

/** The switch-style row used in the drawer and the You page. */
export function ThemeSwitchRow({ className = "lrow" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button type="button" className={className} onClick={() => setTheme(dark ? "light" : "dark")} role="switch" aria-checked={dark}>
      <span className="li">
        <Icon name={dark ? "moon" : "sun"} />
      </span>
      <span className="lt">
        <b>Dark mode</b>
      </span>
      <span className={`sw ${dark ? "on" : ""}`} />
    </button>
  );
}
