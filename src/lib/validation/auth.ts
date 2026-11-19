/**
 * FEATURE: Sign-in and profile validation (shared by browser and server)
 * WHAT: Zod schemas for the email, the 6-digit code and the profile form.
 *       The same schema runs in React Hook Form (client) and again inside the
 *       Server Action (server). [RUBRIC:VALIDATION-CLIENT] [RUBRIC:VALIDATION-SERVER]
 */
import { z } from "zod";

export const HOSTELS = [
  "SR 01",
  "SR 02",
  "SR 03",
  "SR 04",
  "SR 05",
  "SR 06",
  "SR 07",
  "SR 08",
  "SR 09",
  "SR 10",
  "SR 11",
  "SR 12",
  "SR 13",
  "SR 14",
  "SR 15",
  "SR 16A",
  "SR 16B",
  "SR 17",
  "SR 18",
  "SR 19",
  "SR 20",
  "DPM Residence",
  "EPGP Hostel",
  "Executive Residence 01",
  "Executive Residence 02",
  "Executive Residence 03",
  "Executive Residence 04",
  "Married Residence 01",
  "Day scholar",
] as const;
export type Hostel = (typeof HOSTELS)[number];

/**
 * Campus email rule (kept loose on purpose): letters, digits and . _ % + -
 * before the @ (at most 64), no dot at the start or end, no two dots in a row,
 * and it must end in @iimidr.ac.in.
 */
export const EMAIL_RE = /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]{1,64}(?<!\.)@iimidr\.ac\.in$/;

/**
 * Only campus emails: trimmed and lowercased. Typing just the part before the @
 * (e.g. "i25name") is accepted and completed with @iimidr.ac.in.
 */
export const campusEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "Enter your institute email." })
  .transform((t) => (t.includes("@") ? t : `${t}@iimidr.ac.in`))
  .pipe(
    z
      .string()
      .refine((e) => e.endsWith("@iimidr.ac.in"), { error: "Use your @iimidr.ac.in email. Only IIM Indore accounts can use i-bay." })
      .refine((e) => !e.endsWith("@iimidr.ac.in") || EMAIL_RE.test(e), { error: "That email doesn't look right. Check for spaces, extra dots or symbols." }),
  );

/** A person's name: letters from any language, spaces, dots, apostrophes and hyphens. */
export const personName = z
  .string()
  .trim()
  .min(2, { error: "Name must be at least 2 letters." })
  .max(60, { error: "Keep your name under 60 characters." })
  .regex(/^\p{L}[\p{L}\p{M} .'-]*$/u, { error: "Use letters and spaces only." });

export const loginSchema = z
  .object({
    email: campusEmail,
    /** "signup" = Create an account (the email must be new). "signin" = sign in. */
    intent: z.enum(["signin", "signup"]).optional(),
    name: z.string().trim().max(60).optional(),
    captchaToken: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.intent !== "signup") return;
    const r = personName.safeParse(v.name ?? "");
    if (!r.success) ctx.addIssue({ code: "custom", path: ["name"], message: r.error.issues[0].message });
  });
export type LoginInput = z.input<typeof loginSchema>;

export const otpSchema = z.object({
  email: campusEmail,
  // Spaces are dropped so a pasted "123 456" still works.
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, { error: "Enter all 6 digits." })),
});
export type OtpInput = z.infer<typeof otpSchema>;

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const profileSchema = z.object({
  name: personName,
  hostel: z.enum(HOSTELS, { error: "Pick your hostel from the list." }),
  room: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .toUpperCase()
      // Loose on purpose: 212, B204, B-204 and 204A all work.
      .regex(/^(?=.*\d)[A-Z0-9][A-Z0-9 -]{0,9}$/, { error: "Room looks like 212, B204 or B-204." })
      .optional(),
  ),
  whatsapp: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/[\s-]/g, "") : v),
    z.preprocess(emptyToUndef, z.string().regex(/^(\+91)?[6-9]\d{9}$/, { error: "Use a 10 digit Indian mobile number." }).optional()),
  ),
  showWhatsapp: z.boolean().default(false),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** "Delete my account" needs the word DELETE typed exactly. */
export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", { error: "Type DELETE in capitals to confirm." }),
});
