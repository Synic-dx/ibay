/**
 * FEATURE: Validation for requests, bids, offers, chat, ratings and reports
 * WHAT: Shared Zod schemas used by the forms and re-run by every Server Action.
 * [RUBRIC:VALIDATION-CLIENT] [RUBRIC:VALIDATION-SERVER]
 */
import { z } from "zod";
import { CATEGORY_IDS } from "./listing";

const wholeRupees = (msg: string, min = 1) =>
  z.preprocess(
    (v) => (v === "" || v == null ? NaN : typeof v === "string" ? Number(v.replace(/[,\s₹]/g, "")) : v),
    z.number({ error: msg }).int({ error: "Use whole rupees." }).min(min, { error: msg }).max(500000, { error: "That amount is too high." }),
  );

/** "I am looking for a..." request. needed_by is today to +30 days (or no rush). */
export const requestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(5, { error: "Describe what you need in at least 5 characters." })
    .max(120, { error: "Keep it under 120 characters." })
    .refine((t) => /\p{L}{2}/u.test(t), { error: "Describe it in words, e.g. \"fx-991ES calculator\"." }),
  categoryId: z.enum(CATEGORY_IDS, { error: "Choose a category." }),
  budget: z.string().trim().max(40, { error: "Keep the budget under 40 characters." }).default(""),
  neededBy: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const d = new Date(v + "T00:00:00+05:30").getTime();
        const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30").getTime();
        return d >= today && d <= today + 30 * 864e5;
      },
      { error: "Pick a date from today up to 30 days ahead." },
    ),
  captchaToken: z.string().optional(),
});
export type RequestInput = z.input<typeof requestSchema>;

/** "I have this" reply on a request. */
export const replySchema = z.object({
  text: z.string().trim().min(2, { error: "Add a short description." }).max(500, { error: "Keep it under 500 characters." }),
  priceText: z.string().trim().max(40, { error: "Keep the price under 40 characters." }).default(""),
  imageUrl: z.string().max(2048).optional(),
});

/** A bid must be whole rupees and at least the minimum next bid (checked again under a row lock). */
export const bidSchema = (minNext: number) =>
  z.object({
    listingId: z.uuid(),
    amount: wholeRupees(`Bid at least ₹${minNext.toLocaleString("en-IN")}.`).refine((v) => v >= minNext, {
      error: `Bid at least ₹${minNext.toLocaleString("en-IN")}.`,
    }),
  });

/** A structured offer in chat (whole rupees, at least 1). */
export const offerSchema = z.object({
  listingId: z.uuid().optional(),
  amount: wholeRupees("Offer at least ₹1."),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, { error: "Type a message." }).max(1000, { error: "Keep messages under 1,000 characters." }),
});

/** Rating after a deal: score -10 to +10 and a required reason of 10 to 500 characters. */
export const ratingSchema = z.object({
  transactionId: z.uuid(),
  score: z.coerce.number().int().min(-10, { error: "Pick a score from -10 to +10." }).max(10, { error: "Pick a score from -10 to +10." }),
  reason: z
    .string()
    .trim()
    .min(10, { error: "Tell people why in at least 10 characters." })
    .max(500, { error: "Keep it under 500 characters." }),
  tags: z.array(z.string().max(30)).max(6).default([]),
});
export type RatingInput = z.input<typeof ratingSchema>;

export const REPORT_REASONS = [
  ["scam", "Looks like a scam"],
  ["prohibited", "Not allowed on campus"],
  ["offensive", "Offensive or abusive"],
  ["wrong_category", "Wrong category or misleading"],
  ["spam", "Spam"],
  ["other", "Something else"],
] as const;

export const reportSchema = z
  .object({
    listingId: z.uuid().optional(),
    userId: z.uuid().optional(),
    messageId: z.uuid().optional(),
    reason: z.enum(["scam", "prohibited", "offensive", "wrong_category", "spam", "other"], { error: "Pick a reason." }),
    details: z.string().trim().max(500, { error: "Keep it under 500 characters." }).default(""),
    captchaToken: z.string().optional(),
  })
  .refine((v) => v.listingId || v.userId || v.messageId, { error: "Nothing to report." });
