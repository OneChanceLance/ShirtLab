<template>
  <div class="app-shell">
    <div class="app-shell__workspace">
      <div class="embed-container">
        <ShirtLab ref="shirtLabRef" :active-menu="activeMenu" @request-menu="handleMenuRequest" />

        <MenuContent class="menu-overlay" :active-menu="activeMenu" :header-title="headerTitle"
          :selectedObject="selectedObject" :draw="draw" @closeMenu="() => handleMenuRequest('', '')"
          @uploadObject="handleUploadObjectFromMenu" @select-clothing="handleSelectClothingFromMenu"
          @center-text="handleCenterTextFromMenu" @duplicate-text="handleDuplicateTextFromMenu"
          @bring-forward="handleBringForwardFromMenu" @send-back="handleSendBackFromMenu" />
      </div>
    </div>
    <SsActivewearMenu class="ssa-floating-menu" @variant-selected="handleVariantSelected" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, type ComputedRef } from 'vue';
  import ShirtLab from './components/shirtlab/ShirtLab.vue';
  import SsActivewearMenu from './components/SsActivewearMenu.vue';
  import MenuContent from './components/sideMenu/MenuContent.vue';
  import type { ImageObject, TextObject } from './components/shirtlab/types';

  type ShirtLabExpose = {
    applyExternalClothing(payload: any): void;
    selectedObject: ComputedRef<TextObject | ImageObject | null>;
    draw(): void;
    uploadObject(type: string, payload: any): void;
    updateClothing(details: any): void;
    centerSelectedText(): void;
    duplicateSelectedText(): void;
    bringSelectedForward(): void;
    sendSelectedBack(): void;
  };

  const shirtLabRef = ref<ShirtLabExpose | null>(null);

  const activeMenu = ref<string>('');
  const headerTitle = ref<string>('');

  function handleMenuRequest(menu: string, title: string) {
    if (activeMenu.value === menu) {
      activeMenu.value = '';
      headerTitle.value = '';
      return;
    }
    activeMenu.value = menu;
    headerTitle.value = title;
  }

  const selectedObject = computed(() => shirtLabRef.value?.selectedObject.value ?? null);
  const draw = () => shirtLabRef.value?.draw();

  function handleUploadObjectFromMenu(type: string, payload: any) {
    shirtLabRef.value?.uploadObject(type, payload);
  }

  function handleSelectClothingFromMenu(details: any) {
    shirtLabRef.value?.updateClothing(details);
  }

  function handleCenterTextFromMenu() {
    shirtLabRef.value?.centerSelectedText();
  }

  function handleDuplicateTextFromMenu() {
    shirtLabRef.value?.duplicateSelectedText();
  }

  function handleBringForwardFromMenu() {
    shirtLabRef.value?.bringSelectedForward();
  }

  function handleSendBackFromMenu() {
    shirtLabRef.value?.sendSelectedBack();
  }

  function handleVariantSelected(payload: any) {
    if (!shirtLabRef.value) return;
    const imagery = payload?.imagery ?? {};

    shirtLabRef.value.applyExternalClothing({
      front: imagery.front,
      back: imagery.back,
      grid: imagery.grid,
      colors: imagery.colors,
      bgTransform: imagery.bgTransform,
    });
  }
</script>

<style scoped>


  .app-shell {
    position: relative;
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  }

  .app-shell__workspace {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 3rem;
    box-sizing: border-box;
  }

  .embed-container {
    width: 1440px;
    max-width: 95vw;
    background-color: aliceblue;
    height: 560px;
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
  }

  .ssa-floating-menu {
    position: fixed;
    top: 1.5rem;
    left: calc(13.5rem + 2rem);
    z-index: 3000;
  }
</style>
