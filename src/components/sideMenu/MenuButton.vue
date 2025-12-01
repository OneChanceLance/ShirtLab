<template>
  <div class="menu-button" :class="{ active }" @click="$emit('click', variant)">
    <img :src="iconSrc" class="icon" />
    <span>{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const getIcon = (name: string, isActive?: boolean) => {
  const variant = isActive ? "Dark" : "White";
  return new URL(
    `./assets/${name.toLowerCase()}${variant}.png`,
    import.meta.url
  ).href;
};

const props = defineProps<{
  variant: string;
  label: string;
  active?: boolean;
}>();

defineEmits(["click"]);

const iconSrc = computed(() => getIcon(props.variant, props.active));
</script>

<style scoped lang="scss">
.menu-button {
  width: 100%;
  color: white;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: rgb(75, 85, 93);
}

.menu-button.active {
  background-color: rgb(250, 250, 250);
  color: rgb(75, 85, 93);

  span {
    font-weight: 600;
  }
}

.icon {
  margin-bottom: 0.25rem;
  height: 2rem;
  object-fit: contain;
  display: block;
}

:deep(.icon > svg) {
  width: 100%;
  height: 100%;
}

span {
  font-size: 120%;
  font-weight: 300;
  width: 85%;
  text-transform: none;
  font-family: "Anek Latin", sans-serif;
  line-height: normal;
  text-transform: uppercase;
  margin-bottom: -0.25rem;
}
</style>
