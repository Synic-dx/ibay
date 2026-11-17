"use server";
/**
 * FEATURE: Photo upload endpoints for the sell form and profile photo
 * WHAT: getUploadTicket() returns a signed Cloudinary upload (or says "use the
 *       fallback"); uploadFallbackPhoto() stores a photo in Supabase Storage
 *       after checking its real type and size.
 * WHO CAN USE IT: signed-in students, max 40 uploads an hour.
 */
import { getViewer } from "@/lib/auth/session";
import { env, features } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/security/guard";
import { signCloudinary, storeFallbackPhoto, UPLOAD_FOLDER } from "@/lib/uploads";

export type UploadTicket =
  | { provider: "cloudinary"; url: string; fields: Record<string, string> }
  | { provider: "fallback" };

/** A signed, short-lived Cloudinary upload (jpg/png/webp, 5 MB max). */
export async function getUploadTicket(): Promise<ActionResult<UploadTicket>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!(await rateLimit(`upload:${viewer.id}`, 3600, 40))) return fail("Too many uploads. Try again in an hour.");
  if (!features.cloudinary) return ok({ provider: "fallback" });
  const params = { timestamp: Math.floor(Date.now() / 1000), folder: `${UPLOAD_FOLDER}/${viewer.id}`, allowed_formats: "jpg,png,webp" };
  return ok({
    provider: "cloudinary",
    url: `https://api.cloudinary.com/v1_1/${env.cloudName}/image/upload`,
    fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: env.cloudKey, signature: signCloudinary(params) },
  });
}

/** Stores one photo in Supabase Storage (used when Cloudinary is not configured). */
export async function uploadFallbackPhoto(form: FormData): Promise<ActionResult<{ url: string; publicId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!(await rateLimit(`upload:${viewer.id}`, 3600, 40))) return fail("Too many uploads. Try again in an hour.");
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Choose a photo.");
  const r = await storeFallbackPhoto(file, viewer.id);
  return "error" in r ? fail(r.error) : ok(r);
}
