<template>
    <div class="menu-button" :class="{ active }" @click="$emit('click', variant)">
        <component :is="iconComponent" class="icon" />
        <span>{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DrawIcon from 'vue-material-design-icons/Draw.vue';
import TShirtCrewIcon from 'vue-material-design-icons/TshirtCrew.vue';
import FormatTextIcon from 'vue-material-design-icons/FormatText.vue';
import  PaletteIcon from 'vue-material-design-icons/Palette.vue';
import FormatListTextIcon from 'vue-material-design-icons/FormatListText.vue';

const props = defineProps<{
  variant: string
  label: string
  active?: boolean
}>()

defineEmits(['click'])

const iconComponent = computed(() => {
  switch (props.variant) {
    case 'Shirt':
      return TShirtCrewIcon
    case 'Text':
      return FormatTextIcon
    case 'Design':
      return PaletteIcon
    case 'Names':
      return FormatListTextIcon
    default:
      return DrawIcon
  }
})
</script>

<style scoped>
.menu-button {
  width: 90%;
  padding: 0.75rem 0.5rem;
  color: white;
  text-align: center;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.menu-button:hover {
  background-color: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.menu-button:active {
  background-color: rgba(255, 255, 255, 0.03);
  transform: translateY(1px);
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.2);
}

.menu-button.active {
  background-color: rgba(58, 161, 255, 0.12);
  border-left: 3px solid #3aa1ff;
}

.icon {
  font-size: 2.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: block;
}

:deep(.icon > svg) {
  width: 100%;
  height: 100%;
}

span {
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: none;
  font-family: 'Inter', sans-serif;
  color: #e0e0e0;
}
</style>