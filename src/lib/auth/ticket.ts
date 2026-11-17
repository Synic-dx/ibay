/**
 * FEATURE: Sign-in ticket (glue between the OTP check and Auth.js)
 * WHAT: After verifyOtp() checks the 6-digit code, it issues a ticket that is
 *       valid for 60 seconds. The Auth.js "otp" provider accepts only a valid
 *       ticket, so the session cookie is set by Auth.js (httpOnly, sameSite=lax,
 *       CSRF protected) while our action can still show friendly errors such as
 *       "2 tries left".
 * WHY HMAC: the ticket can't be forged without AUTH_SECRET, and it carries the
 *       expiry so it can't be replayed later.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.AUTH_SECRET ?? "";

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/**
 * Creates a short-lived ticket for a profile.
 * @param profileId the profile that just proved it owns the email
 * @param ttlMs lifetime in milliseconds (default 60 s)
 */
export function issueTicket(profileId: string, ttlMs = 60_000): string {
  const payload = `${profileId}.${Date.now() + ttlMs}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Checks a ticket and returns the profile id inside it.
 * @returns the profile id, or null if the ticket is forged or expired
 */
export function readTicket(ticket: string | undefined | null): string | null {
  if (!ticket || !secret()) return null;
  const parts = ticket.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, mac] = parts;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now()) return null;
  return id;
}

/**
 * Secret channel name for a user's realtime "ping" (new message, outbid...).
 * WHY: knowing someone's profile id is not enough to listen to their pings.
 */
export const userChannel = (profileId: string) =>
  "u-" + createHmac("sha256", secret()).update("chan:" + profileId).digest("base64url").slice(0, 24);
