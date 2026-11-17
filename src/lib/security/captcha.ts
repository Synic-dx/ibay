/**
 * FEATURE: CAPTCHA verification on the server [RUBRIC:CAPTCHA]
 * WHAT: verifyCaptcha(token, ip) asks the provider (Cloudflare Turnstile by
 *       default, or hCaptcha / reCAPTCHA v2) whether the token is genuine.
 * WHO CALLS IT: the first step of every Server Action that is spam-prone:
 *       send sign-in code, resend code (after 2 resends), create listing,
 *       post a request and report a user or listing. It runs before any
 *       database work, so a bot never gets an OTP email or a listing.
 * SWITCH: CAPTCHA_PROVIDER=turnstile | hcaptcha | recaptcha | off ("off" only works outside production).
 */

export type CaptchaProvider = "turnstile" | "hcaptcha" | "recaptcha" | "off";

export type CaptchaResult = { success: boolean; errorCodes: string[] };

const VERIFY_URL: Record<Exclude<CaptchaProvider, "off">, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  hcaptcha: "https://api.hcaptcha.com/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
};

export type VerifyOptions = {
  provider?: CaptchaProvider;
  secret?: string;
  isProd?: boolean;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Verifies a CAPTCHA token with the provider.
 * @param token the token the widget gave the browser
 * @param ip the visitor's IP (helps the provider spot abuse)
 * @returns { success, errorCodes }. Never throws: network trouble counts as a failure.
 */
export async function verifyCaptcha(token: string | null | undefined, ip?: string | null, opts: VerifyOptions = {}): Promise<CaptchaResult> {
  const provider = opts.provider ?? ((process.env.CAPTCHA_PROVIDER || "turnstile") as CaptchaProvider);
  const isProd = opts.isProd ?? process.env.NODE_ENV === "production";
  const secret = opts.secret ?? process.env.CAPTCHA_SECRET_KEY ?? "";
  const doFetch = opts.fetchImpl ?? fetch;

  // 1. "off" is a development convenience only. Production always checks.
  if (provider === "off") {
    return isProd ? { success: false, errorCodes: ["captcha-disabled-in-production"] } : { success: true, errorCodes: [] };
  }
  // 2. No token means the widget was never completed.
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };
  if (!secret) return { success: false, errorCodes: ["missing-input-secret"] };

  // 3. Ask the provider, with a timeout so a slow provider can't hang the form.
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000);
  try {
    const res = await doFetch(VERIFY_URL[provider], { method: "POST", body, signal: controller.signal });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return { success: json.success === true, errorCodes: json["error-codes"] ?? [] };
  } catch (e) {
    // WHY: a timeout or network error must not let the form through.
    return { success: false, errorCodes: [e instanceof Error && e.name === "AbortError" ? "timeout" : "network-error"] };
  } finally {
    clearTimeout(timer);
  }
}

/** The message every form shows under the widget when the check fails. */
export const CAPTCHA_ERROR = "Please complete the security check.";
