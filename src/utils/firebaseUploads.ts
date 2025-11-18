import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { UploadMetadata } from 'firebase/storage';

import { getFirebaseStorage } from '../firebaseClient';

const DEFAULT_CACHE_CONTROL = 'public,max-age=3600,immutable';

export type FirebaseUploadOptions = {
  cacheControl?: string;
  metadata?: Omit<UploadMetadata, 'contentType' | 'cacheControl'>;
};

export async function uploadBlobToFirebase(
  objectPath: string,
  blob: Blob,
  contentType: string | null | undefined,
  options?: FirebaseUploadOptions,
): Promise<string | null> {
  const storage = getFirebaseStorage();
  if (!storage) return null;
  const safePath = objectPath.replace(/^\/*/, '');
  const storageRef = ref(storage, safePath);
  try {
    await uploadBytes(storageRef, blob, {
      contentType: contentType ?? blob.type ?? undefined,
      cacheControl: options?.cacheControl ?? DEFAULT_CACHE_CONTROL,
      ...(options?.metadata ?? {}),
    });
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.warn('[FirebaseUploads] Upload failed', { path: safePath }, error);
    return null;
  }
}

export async function upscalePngBlobForUpload(
  blob: Blob,
  minLongSidePx = 5000, // pick your poison: 4500–7000 ish
): Promise<Blob> {
  // If it's not PNG, just bail – don't try to upscale JPEG/SVG/etc
  const type = (blob.type || '').toLowerCase();
  if (!type.includes('png')) return blob;

  const imgUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = imgUrl;
    });

    const longest = Math.max(img.width, img.height);
    if (!longest || longest >= minLongSidePx) {
      // already big enough
      return blob;
    }

    const scale = minLongSidePx / longest;
    const targetWidth = Math.round(img.width * scale);
    const targetHeight = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((scaled) => {
        if (!scaled) {
          resolve(blob);
          return;
        }
        resolve(scaled);
      }, 'image/png', 1.0);
    });
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}
