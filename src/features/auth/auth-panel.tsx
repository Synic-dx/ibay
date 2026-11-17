"use client";
/**
 * FEATURE: Sign in / Create account panel [RUBRIC:AUTH] [RUBRIC:CAPTCHA] [RUBRIC:VALIDATION-CLIENT]
 * WHAT: The content of the blurred auth modal and of /login:
 *   form   -> CAPTCHA, Continue with Google, email (+ name for sign-up), "Send sign-in code"
 *   otp    -> six code boxes, Verify, Resend (30 s cooldown), Change email
 *   onboard-> first login only: hostel chips, room, optional WhatsApp (Skip allowed)
 * FLOW: requestOtp() -> verifyOtp() -> (onboard) -> go to `next` (the page or
 *       action the guest wanted).
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Peacock } from "@/components/brand";
import { Captcha } from "@/features/captcha/captcha";
import { useNoValidate } from "@/lib/hooks/use-novalidate";
import { HOSTELS, loginSchema, type LoginInput } from "@/lib/validation/auth";
import { googleSignIn, requestOtp, verifyOtp } from "./actions";
import { completeOnboarding, skipOnboarding } from "@/features/profile/actions";
import type { AuthGate } from "@/components/app-context";

const GLOGO = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.5 5.8c4.4-4 6.8-10 6.8-17.3z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
);

type Step = "form" | "otp" | "onboard";

export function AuthPanel({
  gate,
  onDone,
  googleEnabled,
  initialError,
}: {
  gate: AuthGate;
  onDone: () => void;
  googleEnabled: boolean;
  initialError?: string | null;
}) {
  const router = useRouter();
  const noValidate = useNoValidate();
  const [mode, setMode] = useState<"signin" | "signup">(gate.mode ?? "signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [capErr, setCapErr] = useState<string | null>(null);
  const [capReset, setCapReset] = useState(0);
  const [formErr, setFormErr] = useState<string | null>(initialError ?? null);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const up = mode === "signup";
  const next = gate.next ?? null;

  const form = useForm<LoginInput>({
    resolver: noValidate ? undefined : zodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "" },
  });
  const onToken = useCallback((t: string | null) => {
    setToken(t);
    if (t) setCapErr(null);
  }, []);

  // Step 1: send the code. The server checks the CAPTCHA before anything else.
  const send = form.handleSubmit(
    (v) =>
      start(async () => {
        setFormErr(null);
        // Client-side CAPTCHA check (the server checks again). Skipped with ?novalidate=1.
        if (!token && !noValidate) {
          setCapErr("Please complete the security check first.");
          return;
        }
        const r = await requestOtp({ email: v.email, name, captchaToken: noValidate ? undefined : (token ?? undefined) });
        if (!r.ok) {
          if (r.fieldErrors?.email) form.setError("email", { message: r.fieldErrors.email });
          if (r.fieldErrors?.captchaToken) {
            setCapErr(r.fieldErrors.captchaToken);
            setCapReset((n) => n + 1);
          } else if (!r.fieldErrors?.email) setFormErr(r.formError ?? "Something went wrong.");
          return;
        }
        setEmail(v.email.trim().toLowerCase());
        setDevCode(r.data.devCode);
        setStep("otp");
      }),
    () => document.getElementById("aem")?.focus(),
  );

  const finish = () => {
    onDone();
    toast("Welcome to i-bay");
    if (next) router.push(next);
    router.refresh();
  };

  const google = () => {
    if (!token && !noValidate) {
      setCapErr("Please complete the security check first.");
      return;
    }
    start(() => googleSignIn(next ?? window.location.pathname));
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      {step === "form" && (
        <>
          <div className="row" style={{ gap: 10 }}>
            <Peacock size={44} />
            <div>
              <h2 id="authT" style={{ fontSize: 20 }}>
                {up ? "Join i-bay" : "Welcome to i-bay"}
              </h2>
              <div className="faint sm">{up ? "Create your account with your IIM Indore email" : "Sign in with your IIM Indore account"}</div>
            </div>
          </div>
          {gate.listing && (
            <div className="ctxprod">
              <div className="ph">
                {gate.listing.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small context thumbnail
                  <img src={gate.listing.photo} alt="" />
                ) : (
                  <Icon name="img" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="sm" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {gate.listing.title}
                </b>
                <span className="xs muted">{gate.listing.price}</span>
              </div>
            </div>
          )}
          {gate.reason && (
            <div className="note">
              <Icon name="lock" />
              <span>{gate.reason}</span>
            </div>
          )}
          {formErr && (
            <div className="formerr" role="alert">
              <Icon name="alert" className="icon i16" />
              {formErr}
            </div>
          )}
          <Captcha onVerify={onToken} resetKey={capReset} error={capErr} id="auth-captcha" />
          {googleEnabled && (
            <>
              <button type="button" className="gbtn" onClick={google} disabled={pending}>
                {GLOGO}
                {up ? "Sign up with Google" : "Continue with Google"}
              </button>
              <div className="faint xs" style={{ textAlign: "center", marginTop: -6 }}>
                Only @iimidr.ac.in Google accounts
              </div>
              <div className="or">or use your email</div>
            </>
          )}
          <form onSubmit={send} className="stack" style={{ gap: 10 }} noValidate>
            {up && (
              <div className="iwrap">
                <Icon name="user" className="icon i18" />
                <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Full name" maxLength={60} />
              </div>
            )}
            <div className="field">
              <div className="iwrap">
                <Icon name="mail" className="icon i18" />
                <input
                  id="aem"
                  className="input"
                  type="email"
                  inputMode="email"
                  placeholder="yourname@iimidr.ac.in"
                  autoComplete="email"
                  aria-label="Institute email"
                  aria-invalid={!!form.formState.errors.email}
                  aria-describedby={form.formState.errors.email ? "aem-err" : undefined}
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <span className="ferr" role="alert" id="aem-err">
                  <Icon name="alert" className="icon i14" />
                  {form.formState.errors.email.message}
                </span>
              )}
            </div>
            <button className="btn block" type="submit" disabled={pending}>
              {pending ? <span className="spin" /> : null}
              {up ? "Create account" : "Send sign-in code"}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="sm" style={{ textAlign: "center" }}>
            {up ? (
              <>
                Already on i-bay?{" "}
                <button type="button" className="btn quiet small" style={{ minHeight: 0, display: "inline" }} onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button type="button" className="btn quiet small" style={{ minHeight: 0, display: "inline" }} onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            )}
          </div>
        </>
      )}
      {step === "otp" && (
        <OtpStep
          email={email}
          name={name}
          devCode={devCode}
          onBack={() => setStep("form")}
          onVerified={(isNew) => (isNew ? setStep("onboard") : finish())}
        />
      )}
      {step === "onboard" && <Onboarding onFinish={finish} />}
    </div>
  );
}

/** The six code boxes. Typing a digit moves to the next box; pasting fills all six. */
function OtpStep({
  email,
  name,
  devCode,
  onBack,
  onVerified,
}: {
  email: string;
  name: string;
  devCode?: string;
  onBack: () => void;
  onVerified: (isNew: boolean) => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [err, setErr] = useState<string | null>(null);
  const [cool, setCool] = useState(30);
  const [pending, start] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  const verify = (code: string) =>
    start(async () => {
      if (!/^\d{6}$/.test(code)) {
        setErr("Enter all 6 digits.");
        return;
      }
      const r = await verifyOtp({ email, code, name });
      if (!r.ok) {
        setErr(r.fieldErrors?.code ?? r.formError ?? "Couldn't verify.");
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
        return;
      }
      onVerified(r.data.isNew);
    });

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole code.
      const all = clean.slice(0, 6).split("");
      const nextDigits = [...all, ...Array(6 - all.length).fill("")];
      setDigits(nextDigits);
      if (all.length === 6) verify(all.join(""));
      return;
    }
    const d = [...digits];
    d[i] = clean;
    setDigits(d);
    setErr(null);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (d.every(Boolean)) verify(d.join(""));
  };

  const resend = () =>
    start(async () => {
      const r = await requestOtp({ email }, true);
      if (!r.ok) {
        setErr(r.formError ?? "Couldn't resend.");
        return;
      }
      setCool(30);
      toast("New code sent");
    });

  return (
    <div className="stack" style={{ gap: 14 }}>
      <button type="button" className="btn quiet small" style={{ alignSelf: "flex-start", padding: 0 }} onClick={onBack}>
        <Icon name="back" />
        Change email
      </button>
      <div>
        <h2 id="authT" style={{ fontSize: 20 }}>
          Check your inbox
        </h2>
        <p className="sm muted">
          Enter the 6-digit code sent to <b>{email}</b>
        </p>
      </div>
      <div className="otp" role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? 6 : 1}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={!!err}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i) refs.current[i - 1]?.focus();
            }}
          />
        ))}
      </div>
      {err && (
        <span className="ferr" role="alert">
          <Icon name="alert" className="icon i14" />
          {err}
        </span>
      )}
      <button type="button" className="btn block" onClick={() => verify(digits.join(""))} disabled={pending}>
        {pending ? <span className="spin" /> : null}Verify
      </button>
      <div className="between sm">
        <span className="faint">Expires in 10 min</span>
        <button type="button" className="btn quiet small" onClick={resend} disabled={cool > 0 || pending}>
          {cool > 0 ? `Resend in ${cool}s` : "Resend"}
        </button>
      </div>
      {devCode && (
        <div className="note">
          <Icon name="info" />
          <span>
            Development: email is not set up, so your code is <b className="mono">{devCode}</b> (also printed in the terminal).
          </span>
        </div>
      )}
    </div>
  );
}

/** First login: where should people meet you? */
export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [hostel, setHostel] = useState<string>("Hostel 1");
  const [room, setRoom] = useState("");
  const [wa, setWa] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await completeOnboarding({ hostel, room, whatsapp: wa });
      if (!r.ok) return setErrs(r.fieldErrors ?? { form: r.formError ?? "" });
      onFinish();
    });
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <Peacock size={40} />
        <div>
          <span className="faint sm">Welcome</span>
          <h2 id="authT" style={{ fontSize: 20 }}>
            Where should people meet you?
          </h2>
        </div>
      </div>
      <div className="chips" role="radiogroup" aria-label="Hostel">
        {HOSTELS.map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hostel === h} className={`chip ${hostel === h ? "on" : ""}`} onClick={() => setHostel(h)}>
            {h}
          </button>
        ))}
      </div>
      <div className="field">
        <div className="iwrap">
          <Icon name="key" className="icon i18" />
          <input className="input" placeholder="Room number, e.g. 212" value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room number" aria-invalid={!!errs.room} />
        </div>
        {errs.room && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{errs.room}</span>}
      </div>
      <div className="field">
        <div className="iwrap">
          <Icon name="chat" className="icon i18" />
          <input className="input" type="tel" placeholder="WhatsApp (optional)" value={wa} onChange={(e) => setWa(e.target.value)} aria-label="WhatsApp number" aria-invalid={!!errs.whatsapp} />
        </div>
        {errs.whatsapp && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{errs.whatsapp}</span>}
      </div>
      <button type="button" className="btn block" onClick={save} disabled={pending}>
        Start using i-bay
      </button>
      <button type="button" className="btn quiet" onClick={() => start(async () => { await skipOnboarding(); onFinish(); })}>
        Skip for now
      </button>
    </div>
  );
}
