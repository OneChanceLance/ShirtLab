<template>
    <div class="top-stepper">
        <div class="steps">
            <template v-for="(step, i) in steps" :key="i">
                <div class="step" :class="{ active: current === i }" @click="goto(i)">
                    <div class="marker">{{ i + 1 }}</div>
                    <div class="label">{{ step }}</div>
                </div>
                <div v-if="i < steps.length - 1" class="connector">
                    <div class="connector-fill"
                        :style="{ width: i < current ? '100%' : i === current ? connectorProgress + '%' : '0%' }"></div>
                </div>
            </template>
        </div>
        <div class="actions" v-if="steps.length > 1">
            <button class="btn" @click="back" :disabled="current === 0" v-if="current > 0">Back</button>
            <button class="btn primary" @click="next" :disabled="current === steps.length - 1"
                v-if="current < steps.length - 1">Next</button>
        </div>
    </div>
    <div class="steps">
        <template v-for="(step, i) in steps" :key="i">
            <div class="step" :class="{ active: current === i, completed: current > i }" @click="goto(i)">
                <div class="marker">
                    <span class="num">{{ i + 1 }}</span>
                    <span class="check">✓</span>
                </div>
                <div class="label">{{ step }}</div>
            </div>
            <div v-if="i < steps.length - 1" class="connector">
                <div class="connector-fill" :style="connectorStyle(i)"></div>
            </div>
        </template>
    </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, watch } from 'vue'

    const props = defineProps<{
        modelValue?: number
        initial?: number
    }>()

    const emit = defineEmits(['update:modelValue', 'change-step'])

    const steps = [
        'Select Shirt',
        'Design',
        'Preview',
        'Checkout'
    ]

    const current = ref<number>(props.modelValue ?? props.initial ?? 0)
    const connectorProgress = ref(0)
    const connectorStyle = (i: number) => {
        if (i < current.value) return { width: '100%' }
        if (i === current.value) return { width: connectorProgress.value + '%' }
        return { width: '0%' }
    }

    watch(() => props.modelValue, (v) => {
        if (typeof v === 'number') current.value = v
    })

    function goto(i: number) {
        current.value = i
        emit('update:modelValue', i)
        emit('change-step', i)
    }

    function next() {
        if (current.value < steps.length - 1) {
            goto(current.value + 1)
        }
    }

    function back() {
        if (current.value > 0) goto(current.value - 1)
    }

    watch(current, async () => {
        connectorProgress.value = 0
        await new Promise((r) => setTimeout(r, 30))
        connectorProgress.value = 100
    })

    watch(current, async () => {
        connectorProgress.value = 0
        await new Promise((r) => setTimeout(r, 30))
        connectorProgress.value = 100
    })
</script>

<style scoped>
    .top-stepper {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 1rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.02));
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .steps {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1 1 auto;
    }

    .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        user-select: none;
        width: 110px;
    }

    .step .marker {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #444;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 600;
    }

    .step.active .marker {
        background: #94C940;
        box-shadow: 0 8px 20px rgba(148, 201, 64, 0.18);
    }

    .step .label {
        margin-top: 0.3rem;
        font-size: 0.85rem;
        color: #e6eef2;
        text-align: center;
    }

    .connector {
        width: 80px;
        height: 6px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 4px;
        overflow: hidden;
    }

    .connector-fill {
        height: 100%;
        background: linear-gradient(90deg, #94C940 0%, #00C853 100%);
        width: 0%;
        transition: width 400ms ease;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    .btn {
        padding: 0.4rem 0.9rem;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
        color: #e6eef2;
        cursor: pointer;
    }

    .btn.primary {
        background: linear-gradient(180deg, #1db954, #00c853);
        border: none;
        color: white;
    }

    .btn:disabled {
        opacity: 0.45;
        cursor: default
    }

    @media (max-width: 720px) {
        .step {
            width: 80px
        }

        .connector {
            width: 40px
        }
    }
</style>
