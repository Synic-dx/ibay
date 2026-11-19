/**
 * FEATURE: Loading skeletons shaped like each page
 * WHAT: Grey shimmering blocks shown instantly after a click, while the real
 *       page loads (used by the loading.tsx files). Shapes match the real
 *       layouts so nothing jumps when the content arrives.
 */
import type { CSSProperties, ReactNode } from "react";

/** One shimmering block. */
export function Sk({ w, h = 14, r, style, className = "" }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties; className?: string }) {
  return <div className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Page wrapper: marks the region busy for screen readers. */
export function SkPage({ children, className = "withtabs", label = "Loading" }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <main className={className} aria-busy="true" aria-label={label}>
      {children}
    </main>
  );
}

/** Title + subtitle at the top of a page. */
export function SkHeading({ sub = true }: { sub?: boolean }) {
  return (
    <div className="skp" style={{ gap: 8, marginBottom: 18 }}>
      <Sk w={220} h={28} r={10} />
      {sub && <Sk w={300} h={14} style={{ maxWidth: "80%" }} />}
    </div>
  );
}

/** A row of filter chips. */
export function SkChips({ n = 6 }: { n?: number }) {
  return (
    <div style={{ display: "flex", gap: 8, overflow: "hidden", marginBottom: 16 }}>
      {Array.from({ length: n }, (_, i) => (
        <Sk key={i} w={70 + ((i * 23) % 50)} h={34} r={999} style={{ flex: "none" }} />
      ))}
    </div>
  );
}

/** Product card grid (same grid as the real cards). */
export function SkGrid({ n = 10 }: { n?: number }) {
  return (
    <div className="g2">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pc" style={{ padding: 6 }}>
          <Sk h="auto" style={{ aspectRatio: "1 / 1" }} />
          <Sk h={14} style={{ margin: "10px 4px 6px" }} />
          <Sk w="50%" h={18} style={{ margin: "0 4px 8px" }} />
        </div>
      ))}
    </div>
  );
}

/** A white card with list rows (avatar/icon + two lines), e.g. messages, requests. */
export function SkList({ n = 6, avatar = 44, round = true }: { n?: number; avatar?: number; round?: boolean }) {
  return (
    <div className="lgroup">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skrow">
          <Sk w={avatar} h={avatar} className={round ? "circle" : ""} r={round ? undefined : 12} />
          <div className="skp" style={{ flex: 1, gap: 8 }}>
            <Sk w={`${55 + ((i * 17) % 35)}%`} h={14} />
            <Sk w={`${35 + ((i * 11) % 30)}%`} h={12} />
          </div>
          <Sk w={48} h={12} />
        </div>
      ))}
    </div>
  );
}

/** Avatar + name block at the top of a profile. */
export function SkProfileHead() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
      <Sk w={72} h={72} className="circle" />
      <div className="skp" style={{ flex: 1, gap: 10 }}>
        <Sk w={180} h={22} r={8} />
        <Sk w={240} h={14} style={{ maxWidth: "90%" }} />
      </div>
    </div>
  );
}

/** Row of small stat tiles. */
export function SkStats({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 10, marginBottom: 18 }}>
      {Array.from({ length: n }, (_, i) => (
        <Sk key={i} h={72} r={16} />
      ))}
    </div>
  );
}

/** Item page: photo on the left, title / price / actions / details on the right. */
export function SkItem() {
  return (
    <div className="skitem">
      <div className="skp">
        <Sk h="auto" r={22} style={{ aspectRatio: "1 / 1" }} />
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Sk key={i} w={64} h={64} r={12} />
          ))}
        </div>
      </div>
      <div className="skp" style={{ gap: 14 }}>
        <Sk w={90} h={22} r={999} />
        <Sk w="85%" h={30} r={10} />
        <Sk w="45%" h={34} r={10} />
        <div style={{ display: "flex", gap: 10, margin: "6px 0" }}>
          <Sk h={48} r={999} style={{ flex: 1 }} />
          <Sk h={48} r={999} style={{ flex: 1 }} />
        </div>
        <SkList n={2} />
        <div className="skp" style={{ gap: 8, marginTop: 6 }}>
          <Sk className="line" />
          <Sk className="line" />
          <Sk className="line" w="70%" />
        </div>
      </div>
    </div>
  );
}
