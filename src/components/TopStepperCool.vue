<template>
    <div class="top-stepper simple">
        <div class="progress-track">
            <div class="progress-fill" :style="{ width: progressWidth + '%' }"></div>
        </div>
        <div class="step-labels">
            <div v-for="(step, i) in steps" :key="step" class="step-label"
                :class="{ completed: isCompleted(i), active: current === i }">
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
    import { computed, ref, watch } from 'vue'
    import { useCheckoutStore } from '../stores/checkout'
    import { useCartStore } from '../stores/cart'

    const props = defineProps<{
        modelValue?: number
        initial?: number
    }>()

    const steps = [
        'Select Shirt',
        'Design',
        'Checkout'
    ]

    const checkoutStore = useCheckoutStore()
    const cartStore = useCartStore()

    const hasSelectedShirt = computed(() => checkoutStore.hasVariant)
    const designCommitted = computed(() => !cartStore.isEmpty)
    const hasPressedCheckout = computed(() => checkoutStore.hasPressedCheckout)

    const current = ref<number>(props.modelValue ?? props.initial ?? 0)

    watch(() => props.modelValue, (v) => {
        if (typeof v === 'number') current.value = v
    }, { immediate: true })

    const progressWidth = computed(() => {
        const totalSegments = Math.max(steps.length - 1, 1)
        let completedSegments = 0
        if (hasSelectedShirt.value) completedSegments += 1
        if (designCommitted.value || hasPressedCheckout.value) completedSegments += 1
        const percent = (completedSegments / totalSegments) * 100
        return Number(percent.toFixed(1))
    })

    function isCompleted(i: number) {
        if (i === 0) return hasSelectedShirt.value
        if (i === 1) return designCommitted.value || hasPressedCheckout.value
        return current.value > i
    }
</script>

<style scoped>
    .top-stepper.simple {
        padding: 0.6rem 1rem;
        background-color: rgb(75, 85, 93);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
        background: rgba(255, 255, 255, 0.08);
    }

    .progress-fill {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, #94C940 0%, #00C853 100%);
        transition: width 280ms ease;
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
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .step-label.active {
        color: #ffffff;
    }

    .step-label.completed {
        color: #cfe9d1;
    }

    .step-dot {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        font-weight: 700;
    }

    .step-label.completed .step-dot {
        background: linear-gradient(135deg, #94C940, #00C853);
        border-color: transparent;
        color: #081b11;
        box-shadow: 0 4px 12px rgba(0, 200, 83, 0.35);
    }

    .step-label.active:not(.completed) .step-dot {
        border-color: #ffffff;
        color: #ffffff;
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
