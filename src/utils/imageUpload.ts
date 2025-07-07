
export function handleImageUploadEvent(e: Event): string | undefined {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    return URL.createObjectURL(file);
  }
  return undefined;
}