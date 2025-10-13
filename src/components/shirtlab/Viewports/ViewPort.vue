<template>
    <div class="container" :class="{ active: isActive }" @click="$emit('select', label)" :key="label">
        <div class="viewport">
            <img :src="previewSrc" :alt="`${label} preview`" />
        </div>
        <div :class="['activeLine', { active: isActive }]"></div>
        <span>{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
    defineProps({
        label: {
            type: String,
            required: true
        },
        previewSrc: {
            type: String,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: false
        }
    })

    defineEmits<{ (e: 'select', label: string): void }>();
</script>

<style scoped lang="scss">

    .container {
        :hover {
            cursor: pointer;
        }
    }

    .viewport {
        background-color: rgb(75, 85, 93);
        border: 3px solid rgb(75, 85, 93);
        border-radius: 0.5rem;
        width: fit-content;
        max-width: 5rem;
        height: 5rem;
        margin: 0 auto;
        margin-bottom: -0.15rem;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            pointer-events: none;
            margin: 0;
            padding: 0;
        }
    }

    .activeLine {
        background: transparent;
        margin: 5px auto;
        width: 100%;
        max-width: 5rem;
        height: 0.1rem;
        margin-bottom: -0.25rem;

        &.active {
            background-color: rgb(75, 85, 93);
        }
    }




    span {
        margin: 0 1px;
        font-family: 'Anek Latin';
        font-size: 0.75rem;
        font-weight: 300;
    }

</style>
