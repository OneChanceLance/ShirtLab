export {};

declare global {
  interface Window {
    __shirtlabGenerateHighResPreviews?: () => Promise<void>;
    __shirtlabLogUploadPlan?: (context: string) => void;
  }
}
