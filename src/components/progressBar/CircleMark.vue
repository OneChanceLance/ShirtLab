<template>
    <div class="circle-mark">
        <div :class="['icon-circle', { active }]">

        </div>
        <div class="label">{{ label }}</div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  active?: boolean
}>()
</script>

<style scoped>
    .circle-mark {
        width: 40px;
        height: 40px;
        box-sizing: border-box;
        flex-shrink: 0;
        align-items: center;
        gap: 0.5rem;
    }

    .icon-circle {
      width: 50px;
      height: 50px;
      box-sizing: border-box;
      flex-shrink: 0;
      border-radius: 50%;
      background-color: #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      box-shadow: 0 2px 8px 0 rgba(0, 255, 128, 0.1), 0 0 8px 1px rgba(0, 255, 128, 0.05) inset;
      transition: background-color 0.4s, box-shadow 0.4s;
    }

    .icon-circle.active {
      background-color: #94C940;
      box-shadow: 0 2px 8px 0 rgba(0, 255, 128, 0.25), 0 0 16px 2px rgba(0, 255, 128, 0.15) inset;
    }

    .label {
        font-size: 0.875rem;
        color: #333;
        text-align: center;
        line-height: 1;
        height: 2.4em;
    }
</style>