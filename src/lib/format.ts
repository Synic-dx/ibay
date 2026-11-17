/**
 * FEATURE: Display helpers shared by server and browser
 * WHAT: Rupees, "3 hr ago", countdowns, product age badges, rental units, bid
 *       steps. Copied from the prototype so numbers read exactly the same.
 * NOTE: money is always whole rupees; times are stored in UTC and shown in
 *       India time (Asia/Kolkata).
 */

export const TZ = "Asia/Kolkata";
const MIN = 60e3;
const HR = 36e5;
const DAY = 864e5;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ₹1,23,456 (Indian digit grouping). */
export const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** "just now", "5 min ago", "3 hr ago", "yesterday", "4 days ago". */
export function ago(t: string | number | Date): string {
  const d = Date.now() - new Date(t).getTime();
  if (d < MIN) return "just now";
  if (d < HR) return Math.floor(d / MIN) + " min ago";
  if (d < DAY) return Math.floor(d / HR) + " hr ago";
  const n = Math.floor(d / DAY);
  return n === 1 ? "yesterday" : n + " days ago";
}

/** Countdown text: "2d 4h", "3h 12m", "9m 05s" or "Ended". */
export function left(t: string | number | Date, now = Date.now()): string {
  let d = new Date(t).getTime() - now;
  if (d <= 0) return "Ended";
  const dd = Math.floor(d / DAY);
  d -= dd * DAY;
  const h = Math.floor(d / HR);
  d -= h * HR;
  const m = Math.floor(d / MIN);
  const s = Math.floor((d - m * MIN) / 1000);
  if (dd) return `${dd}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Colour class for timers: red when under `hotMin` minutes, amber when under 6x that. */
export function urgency(t: string | number | Date, hotMin: number, now = Date.now()): "" | "t-hot" | "t-warn" {
  const m = (new Date(t).getTime() - now) / MIN;
  return m < hotMin ? "t-hot" : m < hotMin * 6 ? "t-warn" : "";
}

/** Midnight (India time) of today + offset days, as a Date. */
export function istDay(offset = 0, from = Date.now()): Date {
  const local = new Date(from + 5.5 * HR);
  const midnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offset);
  return new Date(midnightUtc - 5.5 * HR);
}

/** Hour of the day (0 to 23) in India time. */
export const istHour = (t = Date.now()) => new Date(t + 5.5 * HR).getUTCHours();

/** "Today", "Tomorrow", or "Fri, 21 Nov". */
export function dayLabel(offset: number, long = false): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return istDay(offset).toLocaleDateString("en-IN", {
    timeZone: TZ,
    ...(long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" }),
  });
}

/** Day offset (0 = today) of a yyyy-mm-dd date in India time. */
export function dayOffsetOf(date: string): number {
  const target = new Date(date + "T00:00:00+05:30").getTime();
  return Math.round((target - istDay(0).getTime()) / DAY);
}

/** "9 PM" style label for an hour. */
export const hrLabel = (h: number) => {
  const x = ((h % 24) + 24) % 24;
  return (x % 12 || 12) + (x < 12 ? " AM" : " PM");
};

// ---------------------------------------------------------------- product age

/** Whole months since the purchase date, or null if unknown. */
export function ageMonths(purchasedOn: string | null | undefined, now = Date.now()): number | null {
  if (!purchasedOn) return null;
  return Math.max(0, Math.round((now - new Date(purchasedOn).getTime()) / (30.44 * DAY)));
}

/** Badge colour: green < 6 mo, teal 6 to 18, amber 18 to 36, red 3+ years. */
export function ageTone(m: number | null): "a-unk" | "a-fresh" | "a-good" | "a-aging" | "a-old" {
  if (m == null) return "a-unk";
  if (m < 6) return "a-fresh";
  if (m < 18) return "a-good";
  if (m < 36) return "a-aging";
  return "a-old";
}

/** "8 mo old", "1 yr 3 mo old" or the long form "1 year 3 months old". */
export function ageText(m: number | null, long = false): string {
  if (m == null) return "Age unknown";
  if (m < 1) return long ? "Less than a month old" : "Under 1 mo";
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (!y) return `${m} mo${long ? (m > 1 ? "nths" : "nth") : ""} old`;
  return long
    ? `${y} year${y > 1 ? "s" : ""}${r ? ` ${r} month${r > 1 ? "s" : ""}` : ""} old`
    : `${y} yr${r ? ` ${r} mo` : ""} old`;
}

/** "Mar 2025" from a date, or "Not sure". */
export function boughtLabel(purchasedOn: string | null | undefined): string {
  if (!purchasedOn) return "Not sure";
  const d = new Date(purchasedOn);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

/** Percent below the original price, or null. */
export const offPct = (price: number, mrp: number | null | undefined) =>
  mrp && price ? Math.round((1 - price / mrp) * 100) : null;

// ---------------------------------------------------------------- rentals and bids

export type RentUnit = "hour" | "day" | "week" | "month";
/** Short unit for prices: /hr, /day, /week, /month. */
export const unitShort = (u: RentUnit | null | undefined) => (u === "hour" ? "hr" : (u ?? ""));
/** Word for the unit: hour, day, week, month. */
export const unitWord = (u: RentUnit | null | undefined) => u ?? "";

/** Rough weekly cost so rentals with different units can be compared ("≈ ₹/week"). */
export function weeklyCost(price: number, unit: RentUnit | null | undefined): number | null {
  if (unit === "hour" || !unit) return null;
  if (unit === "day") return price * 7;
  if (unit === "month") return price / 4.3;
  return price;
}

/** Minimum step between bids: ₹20 under 500, ₹50 under 2,000, then ₹100. */
export const bidIncrement = (v: number) => (v < 500 ? 20 : v < 2000 ? 50 : 100);

/** Minimum next bid given the current top bid (0 = no bids) and the starting bid. */
export const nextBid = (top: number, reserve: number) => (top ? top + bidIncrement(top) : reserve);
