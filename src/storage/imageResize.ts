/** Longest side, in pixels, a stored Battle Map background may have. */
export const MAX_IMAGE_SIDE = 2048;

export interface ResizedImage { type: string; data: ArrayBuffer; }
/** Returns the downscaled image, or null to keep the original (small enough, or the browser cannot resize). */
export type ImageResizer = (file: Blob, maxSide: number) => Promise<ResizedImage | null>;

/** Size to scale a width x height image to so its longest side is at most `max`, keeping the aspect ratio; null when it already fits. */
export function targetSize(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } | null {
  if (!(width > 0 && height > 0) || Math.max(width, height) <= max) return null;
  const k = max / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Browser resize with createImageBitmap + OffscreenCanvas; null where those are missing (jsdom) or the image already fits. */
const browserResize: ImageResizer = async (file, max) => {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return null;
  const bmp = await createImageBitmap(file);
  try {
    const size = targetSize(bmp.width, bmp.height, max);
    if (!size) return null;
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, size.width, size.height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.92 }); // the browser falls back to PNG if it cannot encode WebP
    return { type: blob.type, data: await blob.arrayBuffer() };
  } finally {
    bmp.close();
  }
};

let resizer: ImageResizer = browserResize;
/** Test seam: swap the resize function (null restores the browser one). */
export const setImageResizer = (fn: ImageResizer | null) => { resizer = fn ?? browserResize; };
export const resizeImage: ImageResizer = (file, max) => resizer(file, max);
