"use client";
/**
 * FEATURE: CAPTCHA widget [RUBRIC:CAPTCHA]
 * WHAT: <Captcha onVerify={setToken} /> shows the security check on login,
 *       sign-up, resend (after 2), create listing, post request and report.
 *       The token it returns is checked again by verifyCaptcha() on the server.
 * PROVIDERS: NEXT_PUBLIC_CAPTCHA_PROVIDER = turnstile (default) | hcaptcha | recaptcha | off.
 *   Turnstile uses appearance "always" so graders can see the checkbox.
 *   On localhost use Cloudflare's test keys: 1x00000000000000000000AA always
 *   passes, 2x00000000000000000000AB always fails.
 * FAILS SAFE: if the script can't load (ad blocker, network) we say so and offer
 *   Retry. The form can't be submitted without a token in production.
 */
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

const PROVIDER = (process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER || "turnstile") as "turnstile" | "hcaptcha" | "recaptcha" | "off";
const SITE_KEY = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY || "1x00000000000000000000AA";
const IS_PROD = process.env.NODE_ENV === "production";

type Props = {
  onVerify: (token: string | null) => void;
  /** Change this number to reset the widget (e.g. after the server rejected a token). */
  resetKey?: number;
  error?: string | null;
  id?: string;
};

declare global {
  interface Window {
    hcaptcha?: { render: (el: HTMLElement, o: object) => string; reset: (id?: string) => void };
    grecaptcha?: { render: (el: HTMLElement, o: object) => number; reset: (id?: number) => void; ready: (cb: () => void) => void };
  }
}

/** Loads a third-party script once. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  });
}

export function Captcha({ onVerify, resetKey = 0, error, id = "captcha" }: Props) {
  const { resolvedTheme } = useTheme();
  const ref = useRef<TurnstileInstance | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Reset when the parent asks (server said the token was bad or used).
  useEffect(() => {
    if (resetKey) {
      ref.current?.reset();
      onVerify(null);
    }
  }, [resetKey, onVerify]);

  // "off" (development only): no widget, a yellow banner, and a placeholder token.
  useEffect(() => {
    if (PROVIDER === "off" && !IS_PROD) onVerify("dev-off");
  }, [onVerify]);

  // hCaptcha and reCAPTCHA v2 checkbox: same component, different script.
  useEffect(() => {
    if (PROVIDER !== "hcaptcha" && PROVIDER !== "recaptcha") return;
    const el = boxRef.current;
    if (!el) return;
    el.innerHTML = "";
    const src = PROVIDER === "hcaptcha" ? "https://js.hcaptcha.com/1/api.js?render=explicit" : "https://www.google.com/recaptcha/api.js?render=explicit";
    const opts = { sitekey: SITE_KEY, theme: resolvedTheme === "dark" ? "dark" : "light", callback: (t: string) => onVerify(t), "expired-callback": () => onVerify(null), "error-callback": () => setFailed(true) };
    loadScript(src)
      .then(() => {
        const tryRender = () => {
          if (PROVIDER === "hcaptcha" && window.hcaptcha) window.hcaptcha.render(el, opts);
          else if (PROVIDER === "recaptcha" && window.grecaptcha?.render) window.grecaptcha.ready(() => window.grecaptcha!.render(el, opts));
          else setTimeout(tryRender, 200);
        };
        tryRender();
      })
      .catch(() => setFailed(true));
  }, [attempt, resolvedTheme, onVerify]);

  if (PROVIDER === "off" && !IS_PROD) {
    return (
      <div className="capoff" role="note">
        <Icon name="alert" className="icon i16" />
        CAPTCHA disabled (dev)
      </div>
    );
  }

  const errId = `${id}-err`;
  return (
    <div id={id} aria-describedby={error ? errId : undefined}>
      {failed ? (
        <div className="caperr" role="alert">
          <span>Security check didn&apos;t load or didn&apos;t pass. Turn off ad blockers or try another network.</span>
          <button
            type="button"
            className="btn sec small"
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            <Icon name="undo" />
            Retry
          </button>
        </div>
      ) : PROVIDER === "turnstile" ? (
        <Turnstile
          key={attempt}
          ref={ref}
          siteKey={SITE_KEY}
          options={{ appearance: "always", theme: resolvedTheme === "dark" ? "dark" : "light", size: "flexible" }}
          onSuccess={(t) => onVerify(t)}
          onExpire={() => onVerify(null)}
          onError={() => {
            onVerify(null);
            setFailed(true);
            console.warn("[i-bay] CAPTCHA failed to load or verify in the browser");
          }}
          style={{ maxWidth: 340 }}
        />
      ) : (
        <div ref={boxRef} />
      )}
      {error && (
        <span className="ferr" role="alert" id={errId}>
          <Icon name="alert" className="icon i14" />
          {error}
        </span>
      )}
    </div>
  );
}
