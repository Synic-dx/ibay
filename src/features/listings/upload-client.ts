"use client";
/**
 * FEATURE: Upload one photo from the browser
 * WHAT: Checks type and size first (friendly message straight away), then
 *       uploads to Cloudinary with a server-signed ticket, or through the
 *       server fallback. Returns the URL and id to save with the listing.
 */
import { MAX_PHOTO_BYTES, PHOTO_FORMATS_TEXT, isPhotoFile } from "@/lib/validation/listing";
import { getUploadTicket, uploadFallbackPhoto } from "./actions/upload";
import { shrinkImage } from "@/lib/shrink-image";

export async function uploadPhoto(picked: File): Promise<{ url: string; publicId: string } | { error: string }> {
  // 0. Shrink big phone photos so uploads are quick (Cloudinary converts HEIC and the rest).
  const file = await shrinkImage(picked);
  // 1. Client-side check (the server checks the real bytes again).
  if (!isPhotoFile(file)) return { error: `Use a photo: ${PHOTO_FORMATS_TEXT}.` };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Each photo must be 10 MB or smaller." };
  // 2. Ask the server how to upload.
  const t = await getUploadTicket();
  if (!t.ok) return { error: t.formError ?? "Upload failed." };
  if (t.data.provider === "fallback") {
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadFallbackPhoto(fd);
    return r.ok ? r.data : { error: r.formError ?? "Upload failed." };
  }
  // 3. Signed upload straight to Cloudinary.
  const fd = new FormData();
  Object.entries(t.data.fields).forEach(([k, v]) => fd.set(k, v));
  fd.set("file", file);
  const res = await fetch(t.data.url, { method: "POST", body: fd }).catch(() => null);
  if (!res || !res.ok) return { error: "Upload failed. Check your connection and try again." };
  const j = (await res.json()) as { secure_url: string; public_id: string };
  return { url: displayUrl(j.secure_url), publicId: j.public_id };
}

/**
 * The link we save for a Cloudinary photo. f_auto,q_auto makes Cloudinary send
 * each browser a format it can show (WebP or AVIF, else JPEG/PNG), so HEIC, TIFF
 * and BMP originals display everywhere, compressed. The .jpg ending is only a
 * safe default; f_auto picks the real format.
 */
export function displayUrl(secureUrl: string): string {
  return secureUrl.replace("/image/upload/", "/image/upload/f_auto,q_auto/").replace(/\.(heic|heif|tiff?|bmp)$/i, ".jpg");
}
