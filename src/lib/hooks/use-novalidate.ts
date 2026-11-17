"use client";
/**
 * FEATURE: Demo switch "?novalidate=1" [RUBRIC:VALIDATION-SERVER]
 * WHAT: In development only, adding ?novalidate=1 to the URL turns off the
 *       browser-side checks (Zod in React Hook Form and the CAPTCHA token), so
 *       you can submit a bad form and watch the SERVER reject it with the same
 *       messages. Ignored in production builds.
 */
import { useSearchParams } from "next/navigation";

export function useNoValidate(): boolean {
  const sp = useSearchParams();
  return process.env.NODE_ENV !== "production" && sp.get("novalidate") === "1";
}
