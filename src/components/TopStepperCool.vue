<template>
  <div class="top-stepper simple">
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: progressWidth + '%' }"></div>
    </div>
    <div class="step-labels">
      <div
        v-for="(step, i) in steps"
        :key="step"
        class="step-label"
        :class="{ completed: isCompleted(i), active: current === i }"
      >
        <div class="step-dot">
          <span v-if="!isCompleted(i)">{{ i + 1 }}</span>
          <span v-else>✓</span>
        </div>
        <span class="step-text">{{ step }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCheckoutStore } from "../stores/checkout";
import { useCartStore } from "../stores/cart";

const props = defineProps<{
  modelValue?: number;
  initial?: number;
}>();

const steps = ["Select Shirt", "Design", "Checkout"];

const checkoutStore = useCheckoutStore();
const cartStore = useCartStore();

const hasSelectedShirt = computed(() => checkoutStore.hasVariant);
const designCommitted = computed(() => !cartStore.isEmpty);
const hasPressedCheckout = computed(() => checkoutStore.hasPressedCheckout);

const current = ref<number>(props.modelValue ?? props.initial ?? 0);

watch(
  () => props.modelValue,
  (v) => {
    if (typeof v === "number") current.value = v;
  },
  { immediate: true }
);

const progressWidth = computed(() => {
  const totalSegments = Math.max(steps.length - 1, 1);
  let completedSegments = 0;
  if (hasSelectedShirt.value) completedSegments += 1;
  if (designCommitted.value || hasPressedCheckout.value) completedSegments += 1;
  const percent = (completedSegments / totalSegments) * 100;
  return Number(percent.toFixed(1));
});

function isCompleted(i: number) {
  if (i === 0) return hasSelectedShirt.value;
  if (i === 1) return designCommitted.value || hasPressedCheckout.value;
  return current.value > i;
}
</script>

<style scoped>
.step-label.active:not(.completed) .step-dot[data-v-a75ed6e6] {
}
@media (max-width: 640px) {
  .top-stepper.simple[data-v-a75ed6e6] {
    padding: 0.5rem 0.6rem;
  }
  .step-text[data-v-a75ed6e6] {
    font-size: 0.7rem;
  }
}
.background-frame[data-v-e8c22c60] {
  height: 100%;
  width: 100vw;
  background-color: #d0d3d3;
}

.top-stepper.simple {
  padding: 0.6rem 1rem;
  background-color: #4b555d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
}

.progress-track {
  position: relative;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  background: #ffffff14;
}

.progress-fill {
  position: absolute;
  inset: 0;
  background: #94c940;
  transition: width 0.28s ease;
}

.step-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.step-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #94c940;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 500;
}

.step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #94c940;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.step-label.completed .step-dot {
  background: #94c940;
  border-color: transparent;
  color: white;
}

.step-label.active:not(.completed) .step-dot {
  border-color: #94c940;
  color: white;
  background-color: #94c940;
}

@media (max-width: 640px) {
  .top-stepper.simple {
    padding: 0.5rem 0.6rem;
  }

  .step-text {
    font-size: 0.7rem;
  }
}
</style>
