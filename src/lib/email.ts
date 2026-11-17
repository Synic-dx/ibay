/**
 * FEATURE: Emails (Resend)
 * WHAT: The sign-in code email and short notification emails. Plain HTML,
 *       no tracking. Only used when RESEND_API_KEY is set.
 */
import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

const client = () => (env.resendKey ? new Resend(env.resendKey) : null);

const wrap = (body: string) => `
<div style="font-family:Poppins,Arial,sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#20373C">
  <div style="font-weight:700;font-size:22px;letter-spacing:-.04em"><span style="color:#1FC9B2">i</span>-<span style="color:#02637A">b</span><span style="color:#E0A526">a</span><span style="color:#DF524A">y</span></div>
  ${body}
  <p style="font-size:12px;color:#567379;margin-top:24px">IIM Indore's campus marketplace. Only @iimidr.ac.in accounts.</p>
</div>`;

/**
 * Sends the 6-digit sign-in code.
 * @returns true if Resend accepted the email
 */
export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  const r = client();
  if (!r) return false;
  const { error } = await r.emails.send({
    from: env.resendFrom,
    to,
    subject: `${code} is your i-bay sign-in code`,
    html: wrap(`<p style="font-size:15px">Your sign-in code is</p>
      <p style="font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:700;letter-spacing:.2em;margin:8px 0">${code}</p>
      <p style="font-size:13px;color:#3F6068">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`),
  });
  // WHY: log Resend's reason (e.g. "domain is not verified") so setup problems are easy to spot.
  if (error) console.error(`[i-bay] Resend could not send the sign-in code from ${env.resendFrom}:`, error.message);
  return !error;
}

/** Short notification email ("You were outbid", "New offer"...). Fails quietly. */
export async function sendNoticeEmail(to: string, subject: string, text: string, link?: string): Promise<void> {
  const r = client();
  if (!r) return;
  await r.emails
    .send({
      from: env.resendFrom,
      to,
      subject,
      html: wrap(`<p style="font-size:15px">${text.replace(/</g, "&lt;")}</p>${link ? `<p><a href="${env.appUrl}${link}" style="color:#02637A;font-weight:600">Open i-bay</a></p>` : ""}`),
    })
    .catch(() => undefined);
}
