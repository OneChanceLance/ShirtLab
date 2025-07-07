// src/utils/imageUpload.ts

/**
 * Takes a file‐input change event and returns a blob URL
 * for the first selected image, or undefined if no file was chosen.
 */
export function handleImageUploadEvent(e: Event): string | undefined {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    return URL.createObjectURL(file);
  }
  return undefined;
}