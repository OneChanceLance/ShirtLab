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
