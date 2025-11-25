<template>

    <div class="config-container">
        <span>{{ label }}</span>
        <div class="config-details">
            <slot></slot>

            <svg v-if="!noArrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <title>chevron-right</title>
                <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">

    defineProps<{
        label: string
        noArrow?: boolean
    }>()





</script>

<style scoped>
    .config-container {
        background-color: transparent;
        color: rgb(107, 112, 120);
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.75rem 0px;
        box-sizing: border-box;
    }

    .config-container:hover {
        background-color: rgb(248, 248, 248);
        cursor: pointer;
    }

    .config-details {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        width: auto;
        gap: 0.5rem;
        margin-bottom: -10px;
        margin-top: -10px;

    }

    span {
        margin-left: 0.5rem;
        font-family: 'Anek Latin';

    }

    svg {
        width: 1.5rem;
        height: 1.5rem;
        fill: currentColor;
    }

    ::ho
</style>