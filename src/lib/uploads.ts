/**
 * FEATURE: Photo uploads (server side)
 * WHAT: Signs Cloudinary uploads (so only our app can upload to our account),
 *       checks uploaded photos are real photos under 10 MB, and stores
 *       photos in Supabase Storage when Cloudinary is not configured.
 * WHY check on the server: the browser can lie about a file's type and size,
 *       so we read the real bytes (fallback) or ask Cloudinary (signed uploads).
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { env, features } from "@/lib/env";
import { db } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES } from "@/lib/validation/listing";

export const UPLOAD_FOLDER = "ibay";

/**
 * Cloudinary signature for a browser upload.
 * @param params the upload parameters the browser will send (folder, timestamp, ...)
 */
export function signCloudinary(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + env.cloudSecret).digest("hex");
}

/** Detects jpg/png/webp from the first bytes of a file (magic numbers). */
export function sniffImage(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

/**
 * Stores a photo in Supabase Storage after checking its real bytes.
 * @returns the public URL and storage path, or an error message
 */
export async function storeFallbackPhoto(file: File, ownerId: string): Promise<{ url: string; publicId: string } | { error: string }> {
  if (file.size > MAX_PHOTO_BYTES) return { error: "Each photo must be 10 MB or smaller." };
  const buf = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(buf);
  // WHY: this backup store (used only without Cloudinary) can't convert formats.
  if (!type) return { error: "Use a JPG, PNG or WebP photo (other formats need Cloudinary to be set up)." };
  const path = `${ownerId}/${randomUUID()}.${type.split("/")[1].replace("jpeg", "jpg")}`;
  const { error } = await db().storage.from("photos").upload(path, buf, { contentType: type, upsert: false });
  if (error) return { error: "Upload failed. Try again." };
  return { url: db().storage.from("photos").getPublicUrl(path).data.publicUrl, publicId: `sb:${path}` };
}

/**
 * Asks Cloudinary for an uploaded photo's real format and size.
 * @returns null when it is fine, otherwise the problem
 */
export async function checkCloudinaryPhoto(publicId: string): Promise<string | null> {
  if (!features.cloudinary) return "Photo storage is not configured.";
  if (!publicId.startsWith(UPLOAD_FOLDER + "/")) return "That photo was not uploaded through i-bay.";
  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudName}/resources/image/upload/${encodeURIComponent(publicId).replace(/%2F/g, "/")}`, {
    headers: { Authorization: "Basic " + Buffer.from(`${env.cloudKey}:${env.cloudSecret}`).toString("base64") },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return "We couldn't find that photo. Upload it again.";
  const info = (await res.json()) as { format?: string; bytes?: number };
  // Any supported original format is fine: the saved link converts it for each browser.
  if (!["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif", "bmp", "tif", "tiff"].includes(String(info.format))) return "That file isn't a supported photo.";
  if ((info.bytes ?? 0) > MAX_PHOTO_BYTES) return "Each photo must be 10 MB or smaller.";
  return null;
}

/**
 * Checks every photo URL a form sent. Allowed: our Cloudinary folder (verified),
 * our storage bucket, or photos this listing already had.
 * @param existing URLs the listing already has (edit form)
 * @returns an error message for the photos field, or null
 */
export async function verifyPhotos(photos: { url: string; publicId?: string | null }[], existing: string[] = []): Promise<string | null> {
  const storageBase = `${env.supabaseUrl}/storage/v1/object/public/photos/`;
  for (const p of photos) {
    if (existing.includes(p.url)) continue;
    if (p.url.startsWith(storageBase) && p.publicId?.startsWith("sb:")) continue;
    if (p.url.startsWith(`https://res.cloudinary.com/${env.cloudName}/`) && p.publicId) {
      const bad = await checkCloudinaryPhoto(p.publicId);
      if (bad) return bad;
      continue;
    }
    return "One of the photos didn't upload properly. Remove it and add it again.";
  }
  return null;
}
