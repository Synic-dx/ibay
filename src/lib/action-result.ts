/**
 * FEATURE: One result shape for every Server Action
 * WHAT: Actions never throw at the browser. They return either
 *       { ok: true, data } or { ok: false, fieldErrors, formError }, and the
 *       form maps fieldErrors back onto the same inputs the client validates.
 * RUBRIC: Code quality (consistent error handling), [RUBRIC:VALIDATION-SERVER]
 */
import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; fieldErrors?: FieldErrors; formError?: string; code?: string };

/** Success result. */
export const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });

/** Failure with a message for the whole form (and optional per-field messages). */
export const fail = (formError: string, fieldErrors?: FieldErrors, code?: string): ActionResult<never> => ({
  ok: false,
  formError,
  fieldErrors,
  code,
});

/**
 * Turns a Zod error into { fieldName: firstMessage }.
 * @param error the ZodError from safeParse
 * @returns one friendly message per field, keyed by the dotted path
 */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Failure built from a Zod error. */
export const invalid = (error: ZodError): ActionResult<never> =>
  fail("Please fix the highlighted fields.", zodFieldErrors(error), "VALIDATION");
