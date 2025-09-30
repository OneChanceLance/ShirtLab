<template>
  <nav class="side-menu">
    <MenuButton variant="Upload" label="Upload" :active="activeMenu === 'Upload'"
      @click="() => openMenu('Upload', 'Choose File to Upload')" />
    <MenuButton variant="Text" label="Text" :active="activeMenu === 'Text'"
      @click="() => openMenu('Text', 'Add Text')" />
    <MenuButton variant="Icons" label="Icons" :active="activeMenu === 'Icons'"
      @click="() => openMenu('Icons', 'Select Icon')" />
    <MenuButton variant="Shapes" label="Shapes" :active="activeMenu === 'Shapes'"
      @click="() => openMenu('Shapes', 'Choose Shape')" />
    <MenuButton variant="Colors" label="Product Colors" :active="activeMenu === 'Colors'"
      @click="() => openMenu('Colors', 'Pick a Product Color')" />
    <MenuButton variant="Sports" label="Sports Personalization" :active="activeMenu === 'Sports'"
      @click="() => openMenu('Sports', 'Add Sports Info')" />
  </nav>
  <transition name="slide">
    <MenuContent :active-menu="activeMenu ?? undefined" :header-title="headerTitle ?? undefined"
      :selectedObject="selectedObject" :draw="draw" @closeMenu="() => openMenu('', '')"
      @uploadObject="(type: string, payload: any) => emit('uploadObject', type, payload)"
      @select-clothing="emit('selectClothing', $event)" @center-text="$emit('center-text')"
      @duplicate-text="emit('duplicate-text')" @bring-forward="emit('bring-forward')" @send-back="emit('send-back')" />
  </transition>
</template>

<script setup lang="ts">

  import MenuButton from "./MenuButton.vue";
  import { ref, type Ref } from "vue";
  import MenuContent from "./MenuContent.vue";
  import type { ImageObject, TextObject } from "../shirtlab/types";
  defineProps<{
    selectedObject: TextObject | ImageObject | null;
    draw: () => void;

  }>();
  const emit = defineEmits<{
    (e: "selectTool", tool: string): void;
    (e: "uploadObject", type: string, payload: any): void;
    (e: "selectClothing", details: any): void;
    (e: 'center-text'): void;
    (e: 'duplicate-text'): void;
    (e: 'bring-forward'): void;
    (e: 'send-back'): void;
  }>();


  const activeMenu = ref<string>('');
  const headerTitle = ref<string>('');

  function openMenu(menu: string, title?: string) {
    if (activeMenu.value === menu) {
      activeMenu.value = '';
      headerTitle.value = '';
    } else {
      activeMenu.value = menu;
      headerTitle.value = title ?? '';
    }
  }
</script>

<style scoped>
  .side-menu {
    width: 13.5rem;
    height: 100%;
    background: rgb(75, 85, 93);
    display: flex;
    flex-direction: column;
    z-index: 1010;
    align-items: flex-start;
    justify-content: space-between;
  }

  .side-menu>* {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .side-menu>*:first-child {
    margin-top: 1rem;
  }

  .side-menu>*:last-child {
    margin-bottom: 1rem;
  }

  .title {
    color: #ffffff;
    text-transform: uppercase;
    z-index: 5;
    padding: 5px;
  }

  .logo {
    width: 45px;
  }

  .icon {
    font-size: 1.25rem;
    display: block;
    margin-bottom: 0.25rem;
  }

  .logo-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 10px;
    margin-right: 10px;
    margin-bottom: 1rem;
    z-index: 5;
  }

  .brand-text {
    color: white;
    font-size: 1rem;
  }

  /* Slide transition */
  .slide-enter-active,
  .slide-leave-active {
    transition: transform 0.3s ease;
  }

  .slide-enter-from,
  .slide-leave-to {
    transform: translateX(-100%);
  }

  .slide-enter-to,
  .slide-leave-from {
    transform: translateX(0);
  }
</style>
