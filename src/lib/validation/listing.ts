/**
 * FEATURE: Listing validation (the sell and edit form) [RUBRIC:VALIDATION-CLIENT] [RUBRIC:VALIDATION-SERVER]
 * WHAT: One Zod schema, a discriminated union on `mode`, used three times:
 *       1. by React Hook Form in the browser (inline errors as you type),
 *       2. by createListing / updateListing on the server (never trust the browser),
 *       3. mirrored by CHECK constraints in Postgres (the last guard).
 * RULES (from the brief):
 *   common:  title 5 to 80, description up to 1000, category from the list, condition, 1 to 6 photos
 *   sell:    price 0 to 2,00,000; original price required, at least the price, at most 5,00,000;
 *            purchase month required, not in the future, not more than 15 years ago
 *   rent:    rate at least 1; unit hour/day/week/month; deposit 0 to 50,000
 *   auction: starting bid at least 1; optional buy-now above it; ends in 6 h, 1 d, 3 d or 7 d
 *   drop:    price 0 to 2,000; available 15 to 180 minutes; category forced to food
 *   specs:   up to 12 pairs; supplements need a seal status and an expiry that isn't past
 */
import { z } from "zod";
import { HOSTELS } from "./auth";

export const MODES = ["sell", "rent", "auction", "drop"] as const;
export const CONDITIONS = ["New", "Like new", "Very good", "Good", "Fair", "Opened"] as const;
export const RENT_UNITS = ["hour", "day", "week", "month"] as const;
export const AUCTION_HOURS = [6, 24, 72, 168] as const;
export const DROP_MINUTES = [15, 30, 60, 180] as const;
export const SEAL_STATUSES = ["Sealed", "Opened", "Opened, scoop inside"] as const;
export const CATEGORY_IDS = [
  "preprocess", "formals", "ethnic", "events", "books", "exam", "gadgets", "room", "appliances", "food", "free",
  "gym", "sports", "hobbies", "reads", "travel", "clothing", "tickets",
] as const;

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Categories where an original price and purchase month don't apply. */
export const NO_VALUE_CHECK = ["tickets", "free", "food"];

/** Words that mean the item is a supplement (seal + expiry required). */
export const SUPPLEMENT_RE = /protein|whey|creatine|pre.?workout|supplement|multivitamin|bcaa|mass gainer|electrolyte/i;

/** Whole rupees from an input value; "" and junk become NaN so the field shows "required". */
const rupees = (label: string, min: number, max: number, maxMsg?: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : typeof v === "string" ? Number(v.replace(/[,\s₹]/g, "")) : v),
    z
      .number({ error: `Add ${label} in whole rupees.` })
      .int({ error: "Use whole rupees, no paise." })
      .min(min, { error: min === 0 ? `${label[0].toUpperCase() + label.slice(1)} can't be negative.` : `${label[0].toUpperCase() + label.slice(1)} must be at least ₹${min}.` })
      .max(max, { error: maxMsg ?? `That is above the ₹${max.toLocaleString("en-IN")} limit.` }),
  );

const optionalRupees = (label: string, min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), rupees(label, min, max).optional());

const photo = z.object({
  url: z.string().min(1),
  publicId: z.string().nullable().optional(),
  fit: z.enum(["contain", "cover"]).default("cover"),
});

const spec = z.object({
  k: z.string().trim().min(1).max(30),
  v: z.string().trim().min(1).max(60),
});

/** "2025-03" -> checks it is a real month, not in the future, at most 15 years ago. */
export function checkPurchaseMonth(v: string, now = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return "Pick the month and year you bought it.";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return "Pick the month and year you bought it.";
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const picked = y * 12 + (mo - 1);
  if (picked > thisMonth) return "The purchase date can't be in the future.";
  if (thisMonth - picked > 15 * 12) return "That is more than 15 years ago. Pick a later month.";
  return null;
}

const common = {
  title: z
    .string()
    .trim()
    .min(1, { error: "Add a title so people know what it is." })
    .min(5, { error: "Title is too short. Use at least 5 characters, e.g. brand and model." })
    .max(80, { error: "Keep the title under 80 characters." }),
  description: z.string().trim().max(1000, { error: "Keep the description under 1,000 characters." }).default(""),
  condition: z.enum(CONDITIONS, { error: "Pick the condition." }).default("Good"),
  photos: z.array(photo).max(MAX_PHOTOS, { error: `Up to ${MAX_PHOTOS} photos.` }).default([]),
  brand: z.string().trim().max(40).optional(),
  model: z.string().trim().max(60).optional(),
  size: z.string().trim().max(30).optional(),
  specs: z.array(spec).max(12, { error: "Up to 12 size or spec details." }).default([]),
  isBundle: z.boolean().default(false),
  bundleContents: z.string().max(1000).default(""),
  sealStatus: z.string().optional(),
  expiresOn: z.string().optional(),
  pickupHostel: z.enum(HOSTELS).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  pickupNote: z.string().trim().max(300, { error: "Keep handover note under 300 characters." }).optional(),
  /** Optimistic concurrency token (edit only): the updated_at you loaded. */
  updatedAt: z.string().optional(),
  captchaToken: z.string().optional(),
};

const secondHand = {
  categoryId: z.enum(CATEGORY_IDS, { error: "Choose a category." }),
  mrp: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.unknown()),
  purchasedOn: z.string().optional(),
};

export const listingSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("sell"), ...common, ...secondHand, price: rupees("a price", 0, 200000) }),
    z.object({
      mode: z.literal("rent"),
      ...common,
      ...secondHand,
      price: rupees("a rent", 1, 200000),
      rentUnit: z.enum(RENT_UNITS, { error: "Pick hour, day, week or month." }),
      deposit: rupees("a refundable deposit (₹0 is allowed)", 0, 50000, "Deposit can be at most ₹50,000."),
    }),
    z.object({
      mode: z.literal("auction"),
      ...common,
      ...secondHand,
      price: rupees("a starting bid", 1, 200000),
      buyNow: optionalRupees("a buy-now price", 1, 200000),
      durationHours: z.coerce.number().refine((h) => (AUCTION_HOURS as readonly number[]).includes(h), { error: "Pick 6 hours, 1, 3 or 7 days." }),
    }),
    z.object({
      mode: z.literal("drop"),
      ...common,
      categoryId: z.literal("food").default("food"),
      price: rupees("a price", 0, 2000, "Food drops can be at most ₹2,000."),
      availableMinutes: z.coerce.number().int().min(15, { error: "At least 15 minutes." }).max(180, { error: "At most 3 hours." }),
    }),
  ])
  .superRefine((v, ctx) => {
    // Second-hand value check: original price and purchase month (not for drops, tickets or freebies).
    if (v.mode !== "drop" && !NO_VALUE_CHECK.includes(v.categoryId)) {
      const mrp = Number(v.mrp);
      if (v.mrp === undefined || Number.isNaN(mrp)) {
        ctx.addIssue({ code: "custom", path: ["mrp"], message: "Add the original price you paid. Buyers use it to judge the deal." });
      } else if (!Number.isInteger(mrp) || mrp < 1 || mrp > 500000) {
        ctx.addIssue({ code: "custom", path: ["mrp"], message: "Original price must be between ₹1 and ₹5,00,000." });
      } else if (v.mode === "sell" && v.price > mrp) {
        ctx.addIssue({ code: "custom", path: ["mrp"], message: `Your price (₹${v.price.toLocaleString("en-IN")}) is more than what you paid (₹${mrp.toLocaleString("en-IN")}).` });
      }
      const bad = checkPurchaseMonth(v.purchasedOn ?? "");
      if (bad) ctx.addIssue({ code: "custom", path: ["purchasedOn"], message: bad });
    }
    if (v.mode === "auction" && v.buyNow !== undefined && v.buyNow <= v.price) {
      ctx.addIssue({ code: "custom", path: ["buyNow"], message: "Buy-now price must be more than the starting bid." });
    }
    // Photos are required except for food drops (three fields and done).
    if (v.mode !== "drop" && v.photos.length < 1) {
      ctx.addIssue({ code: "custom", path: ["photos"], message: "Add at least one photo." });
    }
    // Supplements: seal status and an expiry date that has not passed.
    if (SUPPLEMENT_RE.test(v.title) || (v.categoryId === "gym" && v.sealStatus)) {
      if (!v.sealStatus) ctx.addIssue({ code: "custom", path: ["sealStatus"], message: "Supplements need a seal status." });
      if (!v.expiresOn) ctx.addIssue({ code: "custom", path: ["expiresOn"], message: "Add the expiry date printed on the pack." });
      else if (new Date(v.expiresOn + "T23:59:59") < new Date()) {
        ctx.addIssue({ code: "custom", path: ["expiresOn"], message: "This has already expired, so it can't be listed." });
      }
    }
  });

export type ListingInput = z.input<typeof listingSchema>;
export type ListingData = z.output<typeof listingSchema>;

/** Fields shown on each step of the 3-step form (used to validate one step at a time). */
export const STEP_FIELDS: Record<1 | 2 | 3, string[]> = {
  1: ["mode", "title", "categoryId", "photos"],
  2: ["price", "mrp", "purchasedOn", "rentUnit", "deposit", "buyNow", "durationHours", "availableMinutes", "size", "specs", "sealStatus", "expiresOn"],
  3: ["condition", "description", "bundleContents", "pickupHostel", "pickupLat", "pickupLng", "pickupNote", "captchaToken"],
};

/** Quick inline price edit from the My listings table. */
export const quickPriceSchema = z.object({
  id: z.uuid(),
  price: rupees("a price", 1, 200000),
});

/** Guess a category from the title (same keyword list as the prototype). */
export function guessCategory(title: string): (typeof CATEGORY_IDS)[number] | null {
  const t = title.toLowerCase();
  const rules: [(typeof CATEGORY_IDS)[number], RegExp][] = [
    ["gym", /protein|whey|creatine|pre.?workout|shaker|lifting|wrist wrap|resistance band|gym|bcaa|mass gainer/],
    ["free", /^free/],
    ["preprocess", /wig|costume|makeup|lipstick|neon|theme/],
    ["ethnic", /saree|kurta|blouse|lehenga|dupatta|sherwani|ethnic|chaniya/],
    ["formals", /blazer|suit|formal|tie|oxford|trouser|two.?piece/],
    ["exam", /cfa|frm|\bcat\b|gmat|calculator|ba ii|schweser|arun sharma|lrdi|dilr|varc|\bqa\b|pyq|casio|fx-?\d/],
    ["reads", /novel|manga|comic|harry potter|one piece|naruto|death note|sapiens|atomic habits/],
    ["books", /book|textbook|notes|stationery|case pack|whiteboard/],
    ["gadgets", /laptop|tablet|headset|headphone|earphone|power ?bank|charger|mouse|monitor|smartwatch/],
    ["appliances", /cooler|fan|fridge|kettle|toaster|iron|microwave|coffee|induction/],
    ["room", /mattress|pillow|mirror|lamp|curtain|chair|stool|clock|plant|bucket|shower filter/],
    ["events", /camera|speaker|tripod|ring light|fairy lights|props|decoration/],
    ["hobbies", /guitar|keyboard|ukulele|chess|uno|monopoly|console|game|paint/],
    ["travel", /cycle|bike|helmet|backpack|tent|trolley|suitcase|duffel/],
    ["sports", /racquet|racket|bat|ball|court|non.?marking|yoga|shuttle|tennis|badminton|cricket|football/],
    ["tickets", /ticket|pass|concert|ipl|match|stand.?up/],
    ["clothing", /shirt|jacket|hoodie|shoe|heels|watch|sunglass|shades|loafer|tote|polo|ray-?ban/],
  ];
  for (const [c, re] of rules) if (re.test(t)) return c;
  return null;
}
