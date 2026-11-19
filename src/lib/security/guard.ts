/**
 * FEATURE: Server-side guards shared by Server Actions
 * WHAT: client IP, rate limiting (a Postgres fixed-window counter) and a
 *       CAPTCHA check that also logs the result to captcha_logs.
 */
import "server-only";
import { headers } from "next/headers";
import { db, dbReady } from "@/lib/supabase/server";
import { CAPTCHA_ERROR, verifyCaptcha } from "./captcha";

/** Best guess at the visitor's IP (Vercel and most proxies set x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Counts one hit and says whether it is allowed.
 * @param key e.g. "otp:email:a@iimidr.ac.in" or "mayu:user:<id>"
 * @param windowSeconds length of the window
 * @param max hits allowed per window
 */
export async function rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  if (!dbReady()) return true;
  try {
    const { data, error } = await db().rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
    // WHY: if the limiter itself fails we allow the request rather than lock everyone out mid-demo.
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

/**
 * Verifies the CAPTCHA token and records the attempt.
 * @returns null when it passed, or the field error message to show.
 */
export async function checkCaptcha(token: string | undefined, action: string): Promise<string | null> {
  const ip = await clientIp();
  const res = await verifyCaptcha(token, ip);
  await db().from("captcha_logs").insert({ action, ip, success: res.success, error_codes: res.errorCodes });
  return res.success ? null : CAPTCHA_ERROR;
}
