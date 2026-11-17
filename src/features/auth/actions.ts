"use server";
/**
 * FEATURE: Email + 6-digit code sign-in [RUBRIC:AUTH] [RUBRIC:CAPTCHA]
 * WHAT: requestOtp() emails a code; verifyOtp() checks it and signs you in.
 * SECURITY (what to say in Q&A):
 *   - the CAPTCHA is checked first, so bots can't make us send OTP emails
 *   - the domain is checked on the server (never trust the browser)
 *   - only a bcrypt hash of the code is stored; codes expire in 10 minutes
 *   - 5 wrong tries lock that code; resend has a 30 s cooldown
 *   - rate limits per email (5 codes / 15 min) and per IP (20 / 15 min)
 *   - the session is an httpOnly, sameSite=lax cookie set by Auth.js
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { issueTicket } from "@/lib/auth/ticket";
import { upsertProfileByEmail } from "@/lib/auth/profiles";
import { env, features } from "@/lib/env";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { checkCaptcha, clientIp, rateLimit } from "@/lib/security/guard";
import { loginSchema, otpSchema, type LoginInput, type OtpInput } from "@/lib/validation/auth";
import { sendOtpEmail } from "@/lib/email";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

/**
 * Step 1: send a sign-in code.
 * @param input email (+ name when creating an account) and the CAPTCHA token
 * @param resend true when the user tapped "Resend"
 */
export async function requestOtp(input: LoginInput, resend = false): Promise<ActionResult<{ devCode?: string; cooldown: number }>> {
  // 1. Validate the email shape and domain on the server.
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, captchaToken } = parsed.data;

  // 2. Rate limits per email and per IP.
  const ip = await clientIp();
  const okEmail = await rateLimit(`otp:email:${email}`, 900, 5);
  const okIp = await rateLimit(`otp:ip:${ip}`, 900, 20);
  if (!okEmail || !okIp) return fail("Too many codes requested. Wait 15 minutes and try again.", undefined, "RATE");

  // 3. Resend rules: 30 s cooldown. The CAPTCHA is only checked on the first request.
  const { data: last } = await db().from("email_otps").select("id,created_at,resends").eq("email", email).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const resends = resend && last ? last.resends + 1 : 0;
  if (resend && last && Date.now() - new Date(last.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return fail("Wait 30 seconds before asking for another code.", undefined, "COOLDOWN");
  }
  if (!resend) {
    // [RUBRIC:CAPTCHA] verified before any database write or email.
    const capErr = await checkCaptcha(captchaToken, "otp-request");
    if (capErr) return fail(capErr, { captchaToken: capErr }, "CAPTCHA");
  }

  // 4. Make a code, store only its hash.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = await bcrypt.hash(code, 10);
  if (last) await db().from("email_otps").update({ used_at: new Date().toISOString() }).eq("id", last.id);
  const { error } = await db().from("email_otps").insert({ email, code_hash: hash, expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), ip, resends });
  if (error) return fail("Couldn't create a code. Try again.");

  // 5. Email it (or, in local development without Resend, print it to the terminal).
  if (features.email) {
    const sent = await sendOtpEmail(email, code);
    if (!sent) return fail("We couldn't send the email. Try again in a minute.");
  } else {
    console.info(`[i-bay] Sign-in code for ${email}: ${code}`);
  }
  return ok({ devCode: !features.email && !env.isProd ? code : undefined, cooldown: RESEND_COOLDOWN_MS / 1000 }, "Code sent");
}

/**
 * Step 2: check the code and sign in.
 * @returns { isNew } so a first-time user sees the one-screen onboarding
 */
export async function verifyOtp(input: OtpInput & { name?: string }): Promise<ActionResult<{ isNew: boolean }>> {
  // 1. Validate.
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, code } = parsed.data;

  // 2. The latest unused code for this email.
  {
    const { data: row } = await db().from("email_otps").select("*").eq("email", email).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return fail("Ask for a new code first.", { code: "Ask for a new code first." });
    if (new Date(row.expires_at).getTime() < Date.now()) return fail("That code has expired. Tap Resend.", { code: "That code has expired. Tap Resend." });
    if (row.attempts >= 5) return fail("Too many wrong tries. Ask for a new code.", { code: "Too many wrong tries. Ask for a new code." });
    const match = await bcrypt.compare(code, row.code_hash);
    if (!match) {
      const tries = row.attempts + 1;
      await db().from("email_otps").update({ attempts: tries }).eq("id", row.id);
      const msg = tries >= 5 ? "Too many wrong tries. Ask for a new code." : `That code is not right. ${5 - tries} ${5 - tries === 1 ? "try" : "tries"} left.`;
      return fail(msg, { code: msg });
    }
    await db().from("email_otps").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  }

  // 3. Find or create the profile, then let Auth.js set the session cookie.
  let profile: { id: string; isNew: boolean };
  try {
    profile = await upsertProfileByEmail(email, input.name);
  } catch (e) {
    if (e instanceof Error && e.message === "BANNED") return fail("This account has been suspended. Contact the i-bay team.");
    return fail("Couldn't sign you in. Try again.");
  }
  try {
    await signIn("otp", { ticket: issueTicket(profile.id), redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return fail("Couldn't sign you in. Try again.");
    throw e;
  }
  const { data: p } = await db().from("profiles").select("onboarded").eq("id", profile.id).single();
  return ok({ isNew: !p?.onboarded }, "Signed in");
}

/** Continue with Google (domain-locked in lib/auth). */
export async function googleSignIn(next: string) {
  await signIn("google", { redirectTo: next.startsWith("/") ? next : "/" });
}

/** Signs out everywhere this browser is signed in (clears the session cookie). */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
