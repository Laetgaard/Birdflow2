import { adminSessionHeaders } from "@/lib/adminSession";

/**
 * Uploads an image through the optimized-image pipeline and registers it in
 * the website's media library. Shared by PropertiesPanel, the custom
 * component editor and the brand guide panel.
 */
export async function uploadImage(
  websiteId: string,
  accessToken: string,
  file: File
): Promise<{ url: string; mediaId: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const optimizedRes = await fetch('/api/uploads/optimized-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (!optimizedRes.ok) {
    throw new Error('Failed to upload and optimize image');
  }

  const { objectPath, optimizedSize } = await optimizedRes.json();

  let width: number | undefined;
  let height: number | undefined;
  if (file.type.startsWith('image/')) {
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => {
        width = img.naturalWidth;
        height = img.naturalHeight;
        resolve();
      };
      img.src = URL.createObjectURL(file);
    });
  }

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
  });

  if (!createRes.ok) throw new Error('Failed to create media record');
  const media = await createRes.json();

  const urlRes = await fetch(`/api/websites/${websiteId}/media/${media.id}/url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!urlRes.ok) throw new Error('Failed to get media URL');
  const { url } = await urlRes.json();

  return { url, mediaId: media.id };
}
