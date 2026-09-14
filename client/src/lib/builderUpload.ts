import { adminSessionHeaders } from "@/lib/adminSession";
import type { ImageValue } from "@shared/rendering/imageValue";

/** What the picker accepts. Anything else is refused before a byte is sent. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Why this file cannot be uploaded, in Danish, or null when it can. */
export function validateImageFile(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/")) return "Filen er ikke et billede.";
  if (!ACCEPTED_IMAGE_TYPES.includes(type)) {
    return "Filtypen understøttes ikke. Brug JPG, PNG, WebP, AVIF, GIF eller SVG.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Billedet fylder ${(file.size / (1024 * 1024)).toFixed(1)} MB. Grænsen er 15 MB.`;
  }
  return null;
}

const UPLOAD_TIMEOUT_MS = 120_000;
const API_TIMEOUT_MS = 30_000;

/**
 * Uploads an image through the optimized-image pipeline and registers it in
 * the website's media library. Shared by PropertiesPanel, the image picker,
 * the custom component editor and the brand guide panel.
 *
 * The natural size comes back from the server, which has already rotated,
 * rasterised and resized the file — measuring the original in the browser
 * (as this used to) reported the size of something else, and a failed
 * decode left the promise hanging forever.
 */
export async function uploadImage(
  websiteId: string,
  accessToken: string,
  file: File
): Promise<ImageValue & { url: string; mediaId: string }> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const formData = new FormData();
  formData.append('image', file);

  const optimizedRes = await fetch('/api/uploads/optimized-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!optimizedRes.ok) {
    throw new Error('Billedet kunne ikke uploades. Prøv igen.');
  }

  const { objectPath, optimizedSize, width, height } = await optimizedRes.json();

  const filename = objectPath.split('/').pop() || `${Date.now()}.webp`;

  const createRes = await fetch(`/api/websites/${websiteId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...adminSessionHeaders(websiteId),
    },
    body: JSON.stringify({
      filename,
      originalFilename: file.name,
      storagePath: objectPath,
      mimeType: 'image/webp',
      size: optimizedSize,
      width,
      height,
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!createRes.ok) throw new Error('Billedet blev uploadet, men kunne ikke gemmes i mediebiblioteket.');
  const media = await createRes.json();

  const urlRes = await fetch(`/api/websites/${websiteId}/media/${media.id}/url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!urlRes.ok) throw new Error('Billedets adresse kunne ikke hentes.');
  const { url } = await urlRes.json();

  return {
    url,
    mediaId: media.id,
    ...(typeof width === 'number' ? { width } : {}),
    ...(typeof height === 'number' ? { height } : {}),
  };
}
