/**
 * FEATURE: Environment and feature switches
 * WHAT: One place that reads process.env, so the rest of the code asks
 *       "is Google sign-in configured?" instead of poking env vars directly.
 * WHY: Missing optional keys (Resend, Cloudinary, OpenAI, Google) switch the
 *      feature to a safe fallback instead of crashing the demo.
 */
import "server-only";

const read = (k: string) => (process.env[k] ?? "").trim();

export const env = {
  isProd: process.env.NODE_ENV === "production",
  appUrl: read("NEXTAUTH_URL") || "http://localhost:3000",
  authSecret: read("AUTH_SECRET"),
  allowedDomain: read("ALLOWED_EMAIL_DOMAIN") || "iimidr.ac.in",
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  captchaProvider: (read("CAPTCHA_PROVIDER") || "turnstile") as "turnstile" | "hcaptcha" | "recaptcha" | "off",
  captchaSecret: read("CAPTCHA_SECRET_KEY"),
  resendKey: read("RESEND_API_KEY"),
  resendFrom: read("RESEND_FROM") || "i-bay <onboarding@resend.dev>",
  cloudName: read("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
  cloudKey: read("CLOUDINARY_API_KEY"),
  cloudSecret: read("CLOUDINARY_API_SECRET"),
  openaiKey: read("OPENAI_API_KEY"),
  googleId: read("AUTH_GOOGLE_ID"),
  googleSecret: read("AUTH_GOOGLE_SECRET"),
};

/** Which optional integrations are configured. */
export const features = {
  google: Boolean(env.googleId && env.googleSecret),
  email: Boolean(env.resendKey),
  cloudinary: Boolean(env.cloudName && env.cloudKey && env.cloudSecret),
  openai: Boolean(env.openaiKey),
  /** CAPTCHA can only be turned off outside production. */
  captcha: env.captchaProvider !== "off" || env.isProd,
};
