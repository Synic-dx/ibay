/**
 * FEATURE: Brand marks
 * WHAT: <Peacock /> is Mayu, the mascot (drawn in SVG, colours follow the theme
 *       through --pk and --pk2). <Wordmark /> is "i-bay" with one colour per letter.
 */

/** Mayu the peacock. Decorative unless a parent labels it. */
export function Peacock({ size = 40 }: { size?: number }) {
  const feathers = Array.from({ length: 7 }, (_, i) => -60 + i * 20);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: "none" }}>
      {feathers.map((a) => (
        <g key={a} transform={`rotate(${a} 32 40)`}>
          <ellipse cx="32" cy="15" rx="6" ry="13" style={{ fill: "var(--pk2)" }} />
          <ellipse cx="32" cy="11" rx="3.6" ry="4.6" fill="#23DFC6" />
          <circle cx="32" cy="11" r="1.8" fill="#0B1E22" />
        </g>
      ))}
      <ellipse cx="32" cy="46" rx="8" ry="11" style={{ fill: "var(--pk)" }} />
      <circle cx="32" cy="32" r="6.5" style={{ fill: "var(--pk)" }} />
      <circle cx="30" cy="20" r="1.3" fill="#23DFC6" />
      <circle cx="32" cy="19" r="1.3" fill="#23DFC6" />
      <circle cx="34" cy="20" r="1.3" fill="#23DFC6" />
      <path d="M30 20.5L32 25.5M32 19.5V25.5M34 20.5L32 25.5" style={{ stroke: "var(--pk)" }} strokeWidth="1.2" />
      <circle cx="34" cy="31" r="2.2" fill="#fff" />
      <circle cx="34.5" cy="31" r="1.1" fill="#0B1E22" />
      <path d="M38 33l4 1.5-4 1z" fill="#D99A1B" />
    </svg>
  );
}

/** The i-bay wordmark: i #1FC9B2, - muted, b #02637A (dark #3FB6CF), a #E0A526, y #DF524A. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="wm" style={{ fontSize: size }} aria-label="i-bay">
      <i style={{ color: "#1FC9B2" }}>i</i>
      <i style={{ color: "var(--ink-3)", margin: "0 .02em" }}>-</i>
      <i style={{ color: "#02637A" }}>b</i>
      <i style={{ color: "#E0A526" }}>a</i>
      <i style={{ color: "#DF524A" }}>y</i>
    </span>
  );
}

/** Round avatar: photo if there is one, else initials on the person's colour. */
export function Avatar({ name, url, color, size = 32 }: { name: string; url?: string | null; color?: string | null; size?: number }) {
  const initials = name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  return (
    <span
      className="av"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        ...(url ? { backgroundImage: `url(${url})` } : { background: color ?? "var(--brand)" }),
      }}
      aria-hidden="true"
    >
      {url ? "" : initials}
    </span>
  );
}
