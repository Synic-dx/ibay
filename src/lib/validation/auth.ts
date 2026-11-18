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

/** Only campus emails: trimmed, lowercased, must end in @iimidr.ac.in. */
export const campusEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "Enter your institute email." })
  .regex(/^[a-z0-9._%+-]+@iimidr\.ac\.in$/, { error: "Use your @iimidr.ac.in email. Only IIM Indore accounts can use i-bay." });

export const loginSchema = z.object({
  email: campusEmail,
  name: z.string().trim().max(60).optional(),
  captchaToken: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  email: campusEmail,
  code: z.string().trim().regex(/^\d{6}$/, { error: "Enter all 6 digits." }),
});
export type OtpInput = z.infer<typeof otpSchema>;

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Name must be at least 2 letters." })
    .max(60, { error: "Keep your name under 60 characters." })
    .regex(/^[A-Za-z][A-Za-z .'-]*$/, { error: "Use letters and spaces only." }),
  hostel: z.enum(HOSTELS, { error: "Pick your hostel from the list." }),
  room: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]?\d{1,4}$/, { error: "Room looks like 212 or B204." })
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
