<template>
  <div class="app-shell">
    <div class="app-shell__workspace">
      <button class="admin-toggle" type="button" @click="toggleAdmin">
        {{ showAdmin ? 'Close Admin' : 'Open Admin Dashboard' }}
      </button>
      <div class="embed-container">
        <ShirtLab ref="shirtLabRef" :active-menu="activeMenu" @request-menu="handleMenuRequest" />

        <MenuContent class="menu-overlay" :active-menu="activeMenu" :header-title="headerTitle"
          :selectedObject="selectedObject" :draw="draw" @closeMenu="() => handleMenuRequest('', '')"
          @uploadObject="handleUploadObjectFromMenu" @select-clothing="handleSelectClothingFromMenu"
          @center-text="handleCenterTextFromMenu" @duplicate-text="handleDuplicateTextFromMenu"
          @bring-forward="handleBringForwardFromMenu" @send-back="handleSendBackFromMenu" />

      </div>
      <div class="money">

      </div>
    </div>
    <SsActivewearMenu class="ssa-floating-menu" @variant-selected="handleVariantSelected" />
    <AdminDashboard v-if="showAdmin" @close="showAdmin = false" @apply="handleAdminApply" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, watchEffect } from 'vue';
  import ShirtLab from './components/shirtlab/ShirtLab.vue';
  import SsActivewearMenu from './components/SsActivewearMenu.vue';
  import MenuContent from './components/sideMenu/MenuContent.vue';
  import AdminDashboard from './components/admin/AdminDashboard.vue';
  import type { ImageObject, TextObject } from './components/shirtlab/types';
  import {
    PRODUCT_COLORS,
    selectedProductColorIndex,
    setProductColors,
    setSelectedProductColorIndex,
    setSelectedProductSize,
  } from './components/sideMenu/types/colorList';

  type ShirtLabExpose = {
    applyExternalClothing(payload: any): void;
    draw(): void;
    uploadObject(type: string, payload: any): void;
    updateClothing(details: any): void;
    centerSelectedText(): void;
    duplicateSelectedText(): void;
    bringSelectedForward(): void;
    sendSelectedBack(): void;
    setClothingImages(imgs: { front?: string; back?: string }): void;
    setBackgroundTransform(transform: { offsetX?: number; offsetY?: number; scale?: number }): void;
  };

  const selectedObject = computed<TextObject | ImageObject | null>(() => {


    return (shirtLabRef.value as any)?.selectedObject ?? null;


  });
  const shirtLabRef = ref<ShirtLabExpose | null>(null);

  const activeMenu = ref<string>('');
  const headerTitle = ref<string>('');
  const isSelectionMenu = ref(false);
  const showAdmin = ref(false);
  const productColors = computed(() => PRODUCT_COLORS.value);
  const lastAppliedColorKey = ref<string | null>(null);

  function handleMenuRequest(menu: string, title: string) {
    isSelectionMenu.value = false;
    if (activeMenu.value === menu) {
      activeMenu.value = '';
      headerTitle.value = '';
      return;
    }
    activeMenu.value = menu;
    headerTitle.value = title;
  }


  const draw = () => shirtLabRef.value?.draw();

  watchEffect(() => {
    console.log('[App/watchEffect] selectedObject ->', selectedObject);
  });

  watch(selectedObject, (val) => {
    console.log('[App] selectedObject ->', val);

    if (!val) {
      if (isSelectionMenu.value) {
        activeMenu.value = '';
        headerTitle.value = '';
        isSelectionMenu.value = false;
      }
      return;
    }

    const type = (val as any).type;
    if (type === 'text') {
      activeMenu.value = 'Text';
      headerTitle.value = 'Add Text';
      isSelectionMenu.value = true;
      return;
    }

    if (type === 'image') {
      const isShape = Boolean((val as any).shapeMeta || (typeof (val as any).name === 'string' && (val as any).name.startsWith('shape:')));
      if (isShape) {
        activeMenu.value = 'Shapes';
        headerTitle.value = 'Choose Shape';
        isSelectionMenu.value = true;
        return;
      }

      const isVector = Boolean((val as any).isVector || (typeof (val as any).name === 'string' && (val as any).name.includes(':')));
      if (isVector) {
        activeMenu.value = 'Icons';
        headerTitle.value = 'Select Icon';
        isSelectionMenu.value = true;
        return;
      }

      activeMenu.value = 'Upload';
      headerTitle.value = 'Choose File to Upload';
      isSelectionMenu.value = true;
    }
  }, { immediate: true });

  function handleUploadObjectFromMenu(type: string, payload: any) {
    shirtLabRef.value?.uploadObject(type, payload);
  }

  function handleSelectClothingFromMenu(details: any) {
    if (details?.colors && Array.isArray(details.colors)) {
      const defaultColorId = details?.default_color_id ?? details?.defaultColorId ?? details?.defaultColorID ?? null;
      syncProductColors(details.colors, defaultColorId);
    }
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
    const colorsList = Array.isArray(payload?.product?.colors)
      ? payload.product.colors
      : Array.isArray(payload?.imagery?.colors)
        ? payload.imagery.colors
        : [];
    const defaultColorId = payload?.color?.id ?? payload?.product?.defaultColorId ?? null;
    syncProductColors(colorsList, defaultColorId);
    if (!shirtLabRef.value) return;
    const imagery = payload?.imagery ?? {};
    const sizeMeasurements = Array.isArray(payload?.sizeMeasurements) ? payload.sizeMeasurements : [];
    const selectedSize = typeof payload?.size === 'string' ? payload.size : null;

    if (Object.prototype.hasOwnProperty.call(payload, 'size')) {
      setSelectedProductSize(selectedSize);
    }

    shirtLabRef.value.applyExternalClothing({
      front: imagery.front,
      back: imagery.back,
      grid: imagery.grid,
      colors: imagery.colors,
      bgTransform: imagery.bgTransform,
      size: selectedSize,
      sizeMeasurements,
    });
  }

  function toggleAdmin() {
    showAdmin.value = !showAdmin.value;
  }

  function resolveMediaMatch(media: any[], regex: RegExp, exclude?: string | null) {
    if (!Array.isArray(media)) return null;
    const match = media.find((item: any) => {
      if (!item) return false;
      const text = item.classType ?? item.location ?? item.description ?? '';
      if (!regex.test(String(text))) return false;
      if (exclude && item.url === exclude) return false;
      return typeof item.url === 'string' && item.url.length > 0;
    });
    return match?.url ?? null;
  }

  function resolveFrontUrl(color: any): string | null {
    if (!color) return null;
    const media = Array.isArray(color.media) ? color.media : [];
    const candidates = [
      color.frontUrl,
      color.frontURL,
      color.front,
      color.imageUrl,
      color.imgUrl,
      resolveMediaMatch(media, /front|primary/i),
      media[0]?.url,
    ];
    return (candidates.find((url) => typeof url === 'string' && url.length > 0) as string | undefined) || null;
  }

  function resolveBackUrl(color: any, fallbackFront?: string | null): string | null {
    if (!color) return fallbackFront ?? null;
    const media = Array.isArray(color.media) ? color.media : [];
    const candidates = [
      color.backUrl,
      color.backURL,
      color.back,
      resolveMediaMatch(media, /rear|back/i, fallbackFront ?? undefined),
      media.find((item: any) => typeof item?.url === 'string' && item.url !== fallbackFront)?.url,
      fallbackFront,
    ];
    return (candidates.find((url) => typeof url === 'string' && url.length > 0) as string | undefined) || null;
  }

  function applySelectedColorToShirtLab() {
    const lab = shirtLabRef.value;
    if (!lab) return;
    const colors = productColors.value;
    if (!Array.isArray(colors) || colors.length === 0) return;
    let idx = selectedProductColorIndex.value ?? 0;
    if (idx < 0 || idx >= colors.length) idx = 0;
    const color = colors[idx] ?? colors[0];
    if (!color) return;

    const front = resolveFrontUrl(color);
    const back = resolveBackUrl(color, front);
    const key = `${color.id ?? idx}|${front ?? ''}|${back ?? ''}`;
    if (lastAppliedColorKey.value === key) return;

    const imagery: { front?: string; back?: string } = {};
    if (front) imagery.front = front;
    if (back) imagery.back = back;
    if (front || back) {
      lab.setClothingImages?.(imagery);
    }

    if (color?.bgTransform || color?.backgroundTransform) {
      lab.setBackgroundTransform?.(color.bgTransform ?? color.backgroundTransform);
    }

    lastAppliedColorKey.value = key;
  }

  function syncProductColors(colors: any[], defaultColorId?: string | null) {
    const normalized = Array.isArray(colors) ? colors : [];
    setProductColors(normalized);
    lastAppliedColorKey.value = null;
    if (!normalized.length) {
      setSelectedProductColorIndex(0);
      applySelectedColorToShirtLab();
      return;
    }
    const initialIndex = defaultColorId ? normalized.findIndex((color: any) => color?.id === defaultColorId) : 0;
    setSelectedProductColorIndex(initialIndex >= 0 ? initialIndex : 0);
    applySelectedColorToShirtLab();
  }

  watch(productColors, () => {
    lastAppliedColorKey.value = null;
    applySelectedColorToShirtLab();
  });

  watch(() => selectedProductColorIndex.value, () => {
    applySelectedColorToShirtLab();
  });

  watch(() => shirtLabRef.value, (lab) => {
    if (lab) applySelectedColorToShirtLab();
  });

  function normalizeGrid(value: any) {
    const grid = value || {};
    const num = (candidate: any, fallback?: number) => {
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      x: num(grid.x, 175),
      y: num(grid.y, 150),
      w: num(grid.w, 250),
      h: num(grid.h, 400),
      widthInches: num(grid.widthInches ?? grid.physicalWidth ?? grid.widthIn ?? grid.width_in),
      heightInches: num(grid.heightInches ?? grid.physicalHeight ?? grid.heightIn ?? grid.height_in),
      dpi: num(grid.dpi ?? grid.pxPerInch ?? grid.pixelsPerInch ?? grid.ppi),
      auto: grid.auto ?? grid.autoGenerated ?? null,
      autoGenerated: grid.autoGenerated ?? grid.auto ?? null,
    };
  }

  function handleAdminApply(record: any) {
    showAdmin.value = false;
    if (!shirtLabRef.value) return;

    const colors = Array.isArray(record?.colors) ? record.colors : [];
    const defaultColorId = record?.default_color_id || record?.defaultColorId || record?.defaultColorID;
    syncProductColors(colors, defaultColorId);
    const primaryColor = colors.find((c: any) => c?.id === defaultColorId) || colors[0] || {};
    const backgrounds = record?.backgrounds || {};

    const front = primaryColor?.frontUrl || primaryColor?.front || primaryColor?.imageUrl || backgrounds.front || null;
    const back = primaryColor?.backUrl || primaryColor?.back || primaryColor?.imageUrl || backgrounds.back || null;
    const bgTransform = primaryColor?.bgTransform || record?.bgTransform || backgrounds?.bgTransform || record?.grid?.bgTransform || null;

    const grid = normalizeGrid(record?.grid);

    shirtLabRef.value.applyExternalClothing({
      grid,
      colors,
      front: front ?? undefined,
      back: back ?? undefined,
      bgTransform: bgTransform ?? undefined,
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
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem 3rem;
    box-sizing: border-box;
    gap: 1rem;
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
    position: relative;
  }


  .ssa-floating-menu {
    position: fixed;
    top: 50rem;
    left: 80rem;
    z-index: 3000;
  }

  .admin-toggle {
    align-self: flex-end;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(148, 201, 64, 0.55);
    color: #e2f5c5;
    padding: 0.45rem 1.3rem;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: transform 0.16s ease, box-shadow 0.2s ease;
  }

  .admin-toggle:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 22px rgba(148, 201, 64, 0.3);
  }

  .admin-toggle:active {
    transform: translateY(0);
  }
</style>
