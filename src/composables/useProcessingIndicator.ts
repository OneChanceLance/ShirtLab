import { computed, reactive } from 'vue';

type ProcessingVariantKey = 'withFront' | 'withBack' | 'withoutFront' | 'withoutBack';

const processingVariantFlags = reactive<Record<ProcessingVariantKey, boolean>>({
  withFront: false,
  withBack: false,
  withoutFront: false,
  withoutBack: false,
});

export const imageProcessingState = reactive({
  active: false,
  completed: 0,
  total: 4,
  label: 'Processing design images',
});

let processingTimeout: ReturnType<typeof setTimeout> | null = null;

function resetProcessingFlags() {
  (Object.keys(processingVariantFlags) as ProcessingVariantKey[]).forEach((key) => {
    processingVariantFlags[key] = false;
  });
}

export function startProcessingIndicator(label = 'Processing design images') {
  imageProcessingState.active = true;
  imageProcessingState.completed = 0;
  imageProcessingState.total = 4;
  imageProcessingState.label = label;
  resetProcessingFlags();
  if (processingTimeout) {
    clearTimeout(processingTimeout);
  }
  processingTimeout = setTimeout(() => {
    finishProcessingIndicator();
  }, 2600);
}

export function finishProcessingIndicator() {
  if (processingTimeout) {
    clearTimeout(processingTimeout);
    processingTimeout = null;
  }
  imageProcessingState.active = false;
}

export function markProcessingVariant(key: ProcessingVariantKey, value: string | null) {
  if (!imageProcessingState.active) return;
  if (processingVariantFlags[key]) return;
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed.length) return;
  processingVariantFlags[key] = true;
  imageProcessingState.completed = Math.min(
    imageProcessingState.total,
    imageProcessingState.completed + 1,
  );
  if (imageProcessingState.completed >= imageProcessingState.total) {
    finishProcessingIndicator();
  }
}

export const processingPercent = computed(() => {
  if (!imageProcessingState.total) return 0;
  return Math.min(
    100,
    Math.round((imageProcessingState.completed / imageProcessingState.total) * 100),
  );
});
