export {};

declare global {
  interface Window {
    __shirtlabGenerateHighResPreviews?: () => Promise<void>;
  }
}

