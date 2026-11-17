/**
 * FEATURE: Plume, the trust score [RUBRIC:EXTRA]
 * WHAT: The maths behind ratings, shared by the rating sheet's live preview and
 *       the unit tests. The database trigger ratings_apply_plume() runs the same
 *       formula, so the preview always matches what gets saved.
 *   delta = K(n) * (rating / 10) * w
 *   K(n)  = max(6, 40 / sqrt(1 + n/3))        n = rated deals so far
 *   w     = clamp(1 + raterPlume / 400, 0.5, 1.5)
 */

/** How far one rating can move someone with n rated deals (new members move fast). */
export const plumeK = (n: number) => Math.max(6, 40 / Math.sqrt(1 + n / 3));

/** How much the rater's own Plume scales their rating (between 0.5 and 1.5). */
export const raterWeight = (raterPlume: number) => Math.min(1.5, Math.max(0.5, 1 + raterPlume / 400));

/**
 * Plume change for one rating, rounded to 0.1 like the database.
 * @param ratedDeals the rated person's deal count before this rating
 * @param score rating from -10 to +10
 * @param raterPlume the rater's current Plume
 */
export const plumeDelta = (ratedDeals: number, score: number, raterPlume: number) =>
  Math.round(plumeK(ratedDeals) * (score / 10) * raterWeight(raterPlume) * 10) / 10;

export type TrustLevel = { label: string; tone: "t-good" | "t-new" | "t-bad" };

/** Trust in words first: New member, Building trust, Trusted, Top rated, Mixed reviews, Flagged. */
export function trustLevel(plume: number, ratedDeals: number): TrustLevel {
  if (!ratedDeals) return { label: "New member", tone: "t-new" };
  if (plume >= 150) return { label: "Top rated", tone: "t-good" };
  if (plume >= 60) return { label: "Trusted", tone: "t-good" };
  if (plume >= 0) return { label: "Building trust", tone: "t-new" };
  if (plume > -60) return { label: "Mixed reviews", tone: "t-bad" };
  return { label: "Flagged", tone: "t-bad" };
}

/** Next level target and progress (0 to 100) for the profile bar. */
export function nextLevel(plume: number): { target: number | null; pct: number; name: string | null } {
  if (plume >= 150) return { target: null, pct: 100, name: null };
  const [lo, target, name] = plume < 60 ? [0, 60, "Trusted"] : [60, 150, "Top rated"];
  return { target, name, pct: Math.max(4, Math.min(100, ((plume - lo) / (target - lo)) * 100)) };
}
