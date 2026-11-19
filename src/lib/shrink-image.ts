/**
 * FEATURE: Make phone photos fit the upload limit
 * WHAT: Phone cameras take 8 to 15 MB photos, slow to upload on campus Wi-Fi. Large or
 *       unusual photos (for example HEIC from an iPhone gallery) are redrawn as
 *       a JPEG at most 2000 px on the long side. Small JPG/PNG/WebP files are
 *       returned untouched. Browser only.
 */
const MAX_EDGE = 2000;
const KEEP_UNDER = 4.5 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * @param file a picked or captured photo
 * @returns the same file if it is already fine, otherwise a smaller JPEG (or the original if the browser can't read it)
 */
export async function shrinkImage(file: File): Promise<File> {
  if (OK_TYPES.includes(file.type) && file.size <= KEEP_UNDER) return file;
  try {
    // WHY: "from-image" keeps phone photos the right way up (EXIF rotation).
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // The browser can't decode it; the normal checks will explain what to do.
    return file;
  }
}
