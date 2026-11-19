/**
 * FEATURE: Browse URL state [RUBRIC:DATA-DISPLAY]
 * WHAT: Every search, filter, sort and page lives in the URL, so a refresh or
 *       a shared link keeps exactly the same view.
 */
export type BrowseState = {
  q: string;
  cat: string;
  coll: string;
  modes: string[];
  near: boolean;
  trusted: boolean;
  avail: string;
  age: number | null;
  min: string;
  max: string;
  size: string;
  sort: string;
  page: number;
};

export const SORTS: [string, string, string][] = [
  ["best", "Best match", "sparkles"],
  ["off", "Biggest discount", "tag"],
  ["low", "Price: low to high", "sort"],
  ["high", "Price: high to low", "sort"],
  ["new", "Newest listings", "clock"],
  ["young", "Newest purchase", "hourglass"],
  ["trust", "Highest Plume", "shield"],
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads browse state from search params (unknown values fall back to defaults). */
export function parseBrowse(sp: SP): BrowseState {
  const sort = one(sp.sort);
  const age = Number(one(sp.age));
  return {
    q: one(sp.q).slice(0, 80),
    cat: one(sp.cat) || "all",
    coll: one(sp.coll),
    modes: one(sp.modes).split(",").filter((m) => ["sell", "rent", "auction", "drop"].includes(m)),
    near: one(sp.near) === "1",
    trusted: one(sp.trusted) === "1",
    avail: /^\d{4}-\d{2}-\d{2}$/.test(one(sp.avail)) ? one(sp.avail) : "",
    age: [6, 12, 24].includes(age) ? age : null,
    min: one(sp.min).replace(/\D/g, ""),
    max: one(sp.max).replace(/\D/g, ""),
    size: one(sp.size).slice(0, 30),
    sort: SORTS.some(([k]) => k === sort) ? sort : "best",
    page: Math.min(20, Math.max(1, Number(one(sp.page)) || 1)),
  };
}

/** Builds a query string from browse state (defaults are left out to keep URLs short). */
export function browseQuery(s: Partial<BrowseState>): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.cat && s.cat !== "all") p.set("cat", s.cat);
  if (s.coll) p.set("coll", s.coll);
  if (s.modes?.length) p.set("modes", s.modes.join(","));
  if (s.near) p.set("near", "1");
  if (s.trusted) p.set("trusted", "1");
  if (s.avail) p.set("avail", s.avail);
  if (s.age) p.set("age", String(s.age));
  if (s.min) p.set("min", s.min);
  if (s.max) p.set("max", s.max);
  if (s.size) p.set("size", s.size);
  if (s.sort && s.sort !== "best") p.set("sort", s.sort);
  if (s.page && s.page > 1) p.set("page", String(s.page));
  const q = p.toString();
  return q ? `?${q}` : "";
}

/** Number of active filters (for the "Filters · 3" chip). */
export const filterCount = (s: BrowseState) =>
  s.modes.length + (s.near ? 1 : 0) + (s.trusted ? 1 : 0) + (s.avail ? 1 : 0) + (s.size ? 1 : 0) + (s.age ? 1 : 0) + (s.min || s.max ? 1 : 0);
