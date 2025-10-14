<template>
  <div class="app-shell">
    <div class="app-shell__workspace">
      <button class="admin-toggle" type="button" @click="toggleAdmin">
        {{ showAdmin ? 'Close Admin' : 'Open Admin Dashboard' }}
      </button>
      <div class="embed-wrapper">
        <div class="embed-container">
          <ShirtLab ref="shirtLabRef" :active-menu="activeMenu" @request-menu="handleMenuRequest" />

          <MenuContent class="menu-overlay" :active-menu="activeMenu" :header-title="headerTitle"
            :selectedObject="selectedObject" :draw="draw" @closeMenu="() => handleMenuRequest('', '')"
            @uploadObject="handleUploadObjectFromMenu" @select-clothing="handleSelectClothingFromMenu"
            @center-text="handleCenterTextFromMenu" @duplicate-text="handleDuplicateTextFromMenu"
            @bring-forward="handleBringForwardFromMenu" @send-back="handleSendBackFromMenu" />
        </div>
        <CheckoutSummaryCard />
        <CheckoutDrawer />
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
  import CheckoutSummaryCard from './components/checkout/CheckoutSummaryCard.vue';
  import CheckoutDrawer from './components/checkout/CheckoutDrawer.vue';
  import type { ImageObject, TextObject } from './components/shirtlab/types';
  import {
    PRODUCT_COLORS,
    selectedProductColorIndex,
    selectedProductSize,
    setProductColors,
    setSelectedProductColorIndex,
    setSelectedProductSize,
  } from './components/sideMenu/types/colorList';
  import { useCheckoutStore } from './stores/checkout';
  import type { CheckoutColorSummary, CheckoutProductSummary } from './stores/checkout';

  type ShirtLabExpose = {
    applyExternalClothing(payload: any): void;
    draw(): void;
    uploadObject(type: string, payload: any): void;
    updateClothing(details: any): void;
    centerSelectedText(): void;
    duplicateSelectedText(): void;
    bringSelectedForward(): void;
    sendSelectedBack(): void;
    setClothingImages(imgs: { front?: string; back?: string; side?: string }): void;
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
  const checkoutStore = useCheckoutStore();

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
    if (!details) return;
    const colors = Array.isArray(details?.colors) ? details.colors : [];
    if (colors.length) {
      const defaultColorId = details?.default_color_id ?? details?.defaultColorId ?? details?.defaultColorID ?? null;
      syncProductColors(colors, defaultColorId);
      syncCheckoutColor();
    }

    const productSummary: CheckoutProductSummary = {
      id: String(details?.id ?? details?.style ?? details?.sku ?? details?.code ?? 'selected-product'),
      name: details?.name ?? details?.productName ?? details?.product_name ?? null,
      brand: details?.brand ?? details?.brandName ?? details?.brand_name ?? null,
      description: details?.description ?? details?.productDescription ?? details?.product_description ?? null,
    };

    const rawMeasurements = Array.isArray(details?.sizeMeasurements)
      ? details.sizeMeasurements
      : Array.isArray(details?.size_measurements)
        ? details.size_measurements
        : [];

    let manualSize: string | null = null;
    if (Object.prototype.hasOwnProperty.call(details, 'size')) {
      manualSize = typeof details.size === 'string' && details.size.trim() ? details.size.trim() : null;
      setSelectedProductSize(manualSize);
    }

    const activeSize = manualSize ?? (typeof selectedProductSize.value === 'string' ? selectedProductSize.value : null);
    const colorSummary = colors.length ? checkoutStore.color : null;
    checkoutStore.setVariant({
      product: productSummary,
      color: colorSummary,
      size: activeSize,
      sizeMeasurements: Array.isArray(rawMeasurements) ? rawMeasurements : [],
    });
    checkoutStore.ensureMinimumQuantity();

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

    const productSummary: CheckoutProductSummary | null = payload?.product
      ? {
        id: String(payload.product.id ?? payload.product.style ?? 'product'),
        name: payload.product.name ?? null,
        brand: payload.product.brand ?? null,
        description: payload.product.description ?? null,
      }
      : null;

    const colorSummary: CheckoutColorSummary | null = payload?.color
      ? {
        id: String(payload.color.id ?? payload.color.code ?? payload.color.name ?? 'color'),
        name: payload.color.name ?? payload.color.id ?? null,
        hex: payload.color.hex ?? null,
        price: parseNullableNumber(payload.color.price),
        currency: payload.color.currency ?? null,
        quantityMin: parseNullableNumber(payload.color.quantityMin),
        frontUrl: imagery.front ?? payload.color.frontUrl ?? null,
        backUrl: imagery.back ?? payload.color.backUrl ?? null,
        sideUrl: imagery.side ?? payload.color.sideUrl ?? null,
      }
      : null;

    checkoutStore.setVariant({
      product: productSummary,
      color: colorSummary,
      size: selectedSize ?? null,
      sizeMeasurements,
    });
    checkoutStore.ensureMinimumQuantity();

    shirtLabRef.value.applyExternalClothing({
      front: imagery.front,
      back: imagery.back,
      side: imagery.side,
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

  function parseNullableNumber(value: any): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

  function resolveSideUrl(color: any, fallbackFront?: string | null, fallbackBack?: string | null): string | null {
    if (!color) return fallbackFront ?? fallbackBack ?? null;
    const media = Array.isArray(color.media) ? color.media : [];
    const candidates = [
      color.sideUrl,
      color.sideURL,
      color.side,
      color.sleeveUrl,
      resolveMediaMatch(media, /side|profile|left|right/i, fallbackFront ?? fallbackBack ?? undefined),
      media.find((item: any) => typeof item?.url === 'string' && /_(sd|d|s)_/i.test(item.url))?.url,
      fallbackFront,
      fallbackBack,
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
    const side = resolveSideUrl(color, front, back);
    const key = `${color.id ?? idx}|${front ?? ''}|${back ?? ''}|${side ?? ''}`;
    if (lastAppliedColorKey.value === key) return;

    const imagery: { front?: string; back?: string; side?: string } = {};
    if (front) imagery.front = front;
    if (back) imagery.back = back;
    if (side) imagery.side = side;
    if (front || back || side) {
      lab.setClothingImages?.(imagery);
    }

    if (color?.bgTransform || color?.backgroundTransform) {
      lab.setBackgroundTransform?.(color.bgTransform ?? color.backgroundTransform);
    }

    lastAppliedColorKey.value = key;
  }

  function syncCheckoutColor() {
    const colors = productColors.value;
    if (!Array.isArray(colors) || colors.length === 0) {
      checkoutStore.setColor(null);
      return;
    }
    let idx = selectedProductColorIndex.value ?? 0;
    if (idx < 0 || idx >= colors.length) idx = 0;
    const color = colors[idx] ?? null;
    if (!color) {
      checkoutStore.setColor(null);
      return;
    }
    const front = resolveFrontUrl(color);
    const back = resolveBackUrl(color, front);
    const side = resolveSideUrl(color, front, back);
    const summary: CheckoutColorSummary = {
      id: String(color?.id ?? color?.colorStyleID ?? idx),
      name: color?.name ?? color?.colorName ?? color?.id ?? `Color ${idx + 1}`,
      hex: typeof color?.hex === 'string' && color.hex
        ? color.hex
        : typeof color?.colorBackground === 'string' && color.colorBackground
          ? color.colorBackground
          : typeof color?.color === 'string' && color.color
            ? color.color
            : typeof color?.background === 'string' && color.background
              ? color.background
              : null,
      price: parseNullableNumber(color?.price ?? color?.salePrice ?? color?.unitPrice),
      currency: typeof color?.currency === 'string' && color.currency
        ? color.currency
        : typeof color?.currencyCode === 'string' && color.currencyCode
          ? color.currencyCode
          : null,
      quantityMin: parseNullableNumber(color?.quantityMin ?? color?.minimumQuantity ?? color?.minQty),
      frontUrl: front,
      backUrl: back,
      sideUrl: side,
    };
    checkoutStore.setColor(summary);
    checkoutStore.ensureMinimumQuantity();
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
    syncCheckoutColor();
  });

  watch(() => selectedProductColorIndex.value, () => {
    applySelectedColorToShirtLab();
    syncCheckoutColor();
  });

  watch(() => shirtLabRef.value, (lab) => {
    if (lab) {
      applySelectedColorToShirtLab();
      syncCheckoutColor();
    }
  });

  watch(() => selectedProductSize.value, (size) => {
    checkoutStore.setSize(typeof size === 'string' ? size : null);
  }, { immediate: true });

  syncCheckoutColor();

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
    const productSummary: CheckoutProductSummary = {
      id: String(record?.id ?? record?.style ?? record?.sku ?? record?.code ?? 'admin-product'),
      name: record?.name ?? record?.productName ?? record?.product_name ?? null,
      brand: record?.brand ?? record?.brandName ?? null,
      description: record?.description ?? record?.productDescription ?? record?.product_description ?? null,
    };
    checkoutStore.setProduct(productSummary);
    if (Array.isArray(record?.size_measurements)) {
      checkoutStore.setSizeMeasurements(record.size_measurements);
    } else if (Array.isArray(record?.sizeMeasurements)) {
      checkoutStore.setSizeMeasurements(record.sizeMeasurements);
    }
    syncProductColors(colors, defaultColorId);
    const primaryColor = colors.find((c: any) => c?.id === defaultColorId) || colors[0] || {};
    const backgrounds = record?.backgrounds || {};

    const front = primaryColor?.frontUrl || primaryColor?.front || primaryColor?.imageUrl || backgrounds.front || null;
    const back = primaryColor?.backUrl || primaryColor?.back || primaryColor?.imageUrl || backgrounds.back || null;
    const side = primaryColor?.sideUrl || primaryColor?.side || backgrounds.side || null;
    const bgTransform = primaryColor?.bgTransform || record?.bgTransform || backgrounds?.bgTransform || record?.grid?.bgTransform || null;

    const grid = normalizeGrid(record?.grid);

    shirtLabRef.value.applyExternalClothing({
      grid,
      colors,
      front: front ?? undefined,
      back: back ?? undefined,
      side: side ?? undefined,
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

  .embed-wrapper {
    position: relative;
    width: 1440px;
    max-width: 95vw;
    border-radius: 1rem;
    overflow: hidden
  }

  .embed-container {
    width: 100%;
    height: 560px;

    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    background: aliceblue;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
    position: relative;
  }

  .checkout-overlay {
    position: absolute;
    top: -1.25rem;
    right: -1.25rem;
    width: min(360px, 32vw);
    pointer-events: none;
  }

  .checkout-overlay :deep(.checkout-card) {
    pointer-events: auto;
  }

  @media (max-width: 1200px) {
    .checkout-overlay {
      position: static;
      width: 100%;
      margin-top: 1.5rem;
    }

    .embed-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
  }

  @media (max-width: 768px) {
    .embed-container {
      height: 420px;
    }

    .checkout-overlay {
      margin-top: 1rem;
    }
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
