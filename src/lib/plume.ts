/**
 * FEATURE: Feather (formerly Plume), the campus trust score [RUBRIC:EXTRA]
 * WHAT: The maths behind ratings, shared by the rating sheet's live preview and
 *       the unit tests. The database trigger ratings_apply_plume() runs the same
 *       formula, so the preview always matches what gets saved.
 *   delta = K(n) * (rating / 10) * w
 *   K(n)  = max(6, 40 / sqrt(1 + n/3))        n = rated deals so far
 *   w     = clamp(1 + raterFeather / 400, 0.5, 1.5)
 */

/** How far one rating can move someone with n rated deals (new members move fast). */
export const featherK = (n: number) => Math.max(6, 40 / Math.sqrt(1 + n / 3));
export const plumeK = featherK;

/** How much the rater's own Feather score scales their rating (between 0.5 and 1.5). */
export const featherWeight = (raterFeather: number) => Math.min(1.5, Math.max(0.5, 1 + raterFeather / 400));
export const raterWeight = featherWeight;

/**
 * Feather change for one rating, rounded to 0.1 like the database.
 * @param ratedDeals the rated person's deal count before this rating
 * @param score rating from -10 to +10
 * @param raterScore the rater's current Feather / Plume score
 */
export const featherDelta = (ratedDeals: number, score: number, raterScore: number) =>
  Math.round(featherK(ratedDeals) * (score / 10) * featherWeight(raterScore) * 10) / 10;
export const plumeDelta = featherDelta;

export type TrustLevel = { label: string; tone: "t-good" | "t-new" | "t-bad" };

/** Feather level in words first: New member, Rising, Well rated, Top rated, Mixed reviews, Flagged. */
export function trustLevel(score: number, ratedDeals: number): TrustLevel {
  if (!ratedDeals) return { label: "New member", tone: "t-new" };
  if (score >= 150) return { label: "Top rated", tone: "t-good" };
  if (score >= 60) return { label: "Well rated", tone: "t-good" };
  if (score >= 0) return { label: "Rising", tone: "t-new" };
  if (score > -60) return { label: "Mixed reviews", tone: "t-bad" };
  return { label: "Flagged", tone: "t-bad" };
}

/** Next level target and progress (0 to 100) for the profile bar. */
export function nextLevel(score: number): { target: number | null; pct: number; name: string | null } {
  if (score >= 150) return { target: null, pct: 100, name: null };
  const [lo, target, name] = score < 60 ? [0, 60, "Well rated"] : [60, 150, "Top rated"];
  return { target, name, pct: Math.max(4, Math.min(100, ((score - lo) / (target - lo)) * 100)) };
}
