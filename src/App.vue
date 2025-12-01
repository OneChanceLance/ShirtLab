<template>
  <div class="app-shell">
    <div class="app-shell__workspace">
      <TopStepperCool
        v-if="!checkoutStore.hasPressedCheckout"
        :modelValue="currentStep"
      />
      <div class="embed-wrapper">
        <div>
          <div class="embed-container" style="--side-menu-width: 13.5rem">
            <SideMenu
              :active-menu="activeMenu"
              :header-title="headerTitle"
              :selectedObject="selectedObject"
              :draw="draw"
              @request-menu="handleMenuRequest"
              @closeMenu="() => handleMenuRequest('', '')"
              @uploadObject="handleUploadObjectFromMenu"
              @select-clothing="handleSelectClothingFromMenu"
              @center-text="handleCenterTextFromMenu"
              @duplicate-text="handleDuplicateTextFromMenu"
              @bring-forward="handleBringForwardFromMenu"
              @send-back="handleSendBackFromMenu"
            />
            <ShirtLab ref="shirtLabRef" />
          </div>
          <CheckoutSummaryCard />
        </div>
        <CartSlideover />
        <CheckoutDrawer />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect } from "vue";
import TopStepperCool from "./components/TopStepperCool.vue";
import ShirtLab from "./components/shirtlab/ShirtLab.vue";
import SideMenu from "./components/sideMenu/SideMenu.vue";
import CheckoutSummaryCard from "./components/checkout/CheckoutSummaryCard.vue";
import type { ImageObject, TextObject } from "./components/shirtlab/types";
import {
  PRODUCT_COLORS,
  selectedProductColorIndex,
  selectedProductSize,
  setProductColors,
  setSelectedProductColorIndex,
  setSelectedProductSize,
} from "./components/sideMenu/types/colorList";
import { useCheckoutStore } from "./stores/checkout";
import type {
  CheckoutColorSummary,
  CheckoutProductSummary,
} from "./stores/checkout";
import CartSlideover from "./components/checkout/CartSlideover.vue";
import CheckoutDrawer from "./components/checkout/CheckoutDrawer.vue";
import { onMounted } from "vue";

onMounted(() => {
  const sendHeight = () => {
    window.parent.postMessage(
      { type: "resize-iframe", height: document.body.scrollHeight },
      "*"
    );
  };

  // send once on load
  sendHeight();

  // observe changes to auto-resize
  const observer = new ResizeObserver(sendHeight);
  observer.observe(document.body);
});

type ShirtLabExpose = {
  applyExternalClothing(payload: any): void;
  draw(): void;
  uploadObject(type: string, payload: any): void;
  updateClothing(details: any): void;
  centerSelectedText(): void;
  duplicateSelectedText(): void;
  bringSelectedForward(): void;
  sendSelectedBack(): void;
  setClothingImages(imgs: {
    front?: string;
    back?: string;
    side?: string;
  }): void;
  setBackgroundTransform(transform: {
    offsetX?: number;
    offsetY?: number;
    scale?: number;
  }): void;
};

const selectedObject = computed<TextObject | ImageObject | null>(() => {
  return (shirtLabRef.value as any)?.selectedObject ?? null;
});
const shirtLabRef = ref<ShirtLabExpose | null>(null);
const currentStep = ref<number>(0);

const activeMenu = ref<string>("");
const headerTitle = ref<string>("");
const isSelectionMenu = ref(false);
const productColors = computed(() => PRODUCT_COLORS.value);
const lastAppliedColorKey = ref<string | null>(null);
const checkoutStore = useCheckoutStore();

function handleMenuRequest(menu: string, title: string) {
  isSelectionMenu.value = false;
  if (activeMenu.value === menu) {
    activeMenu.value = "";
    headerTitle.value = "";
    return;
  }
  activeMenu.value = menu;
  headerTitle.value = title;
}

const draw = () => shirtLabRef.value?.draw();

watchEffect(() => {
  console.log("[App/watchEffect] selectedObject ->", selectedObject);
});

watch(
  selectedObject,
  (val) => {
    console.log("[App] selectedObject ->", val);

    if (!val) {
      if (isSelectionMenu.value) {
        activeMenu.value = "";
        headerTitle.value = "";
        isSelectionMenu.value = false;
      }
      return;
    }

    const type = (val as any).type;
    if (type === "text") {
      activeMenu.value = "Text";
      headerTitle.value = "Add Text";
      isSelectionMenu.value = true;
      return;
    }

    if (type === "image") {
      const elementType =
        typeof (val as any).elementType === "string"
          ? (val as any).elementType
          : null;
      const elementVariant =
        typeof (val as any).elementVariant === "string"
          ? (val as any).elementVariant
          : null;
      const isShape =
        elementType === "shape" ||
        Boolean((val as any).shapeMeta) ||
        (typeof (val as any).name === "string" &&
          (val as any).name.startsWith("shape:"));
      if (isShape) {
        activeMenu.value = "Shapes";
        headerTitle.value = "Choose Shape";
        isSelectionMenu.value = true;
        return;
      }

      const isIcon =
        elementType === "icon" ||
        Boolean(
          (val as any).isVector &&
            elementVariant &&
            elementVariant.includes(":")
        ) ||
        (typeof (val as any).name === "string" &&
          (val as any).name.includes(":"));
      if (isIcon) {
        activeMenu.value = "Icons";
        headerTitle.value = "Select Icon";
        isSelectionMenu.value = true;
        return;
      }

      activeMenu.value = "Upload";
      headerTitle.value = "Choose File to Upload";
      isSelectionMenu.value = true;
    }
  },
  { immediate: true }
);

function handleUploadObjectFromMenu(type: string, payload: any) {
  shirtLabRef.value?.uploadObject(type, payload);
}

function handleSelectClothingFromMenu(details: any) {
  if (!details) return;
  const colors = Array.isArray(details?.colors) ? details.colors : [];
  if (colors.length) {
    const defaultColorId =
      details?.default_color_id ??
      details?.defaultColorId ??
      details?.defaultColorID ??
      null;
    syncProductColors(colors, defaultColorId);
    syncCheckoutColor();
  }

  const productSummary: CheckoutProductSummary = {
    id: String(
      details?.id ??
        details?.style ??
        details?.sku ??
        details?.code ??
        "selected-product"
    ),
    name:
      details?.name ?? details?.productName ?? details?.product_name ?? null,
    brand: details?.brand ?? details?.brandName ?? details?.brand_name ?? null,
    description:
      details?.description ??
      details?.productDescription ??
      details?.product_description ??
      null,
  };

  const rawMeasurements = Array.isArray(details?.sizeMeasurements)
    ? details.sizeMeasurements
    : Array.isArray(details?.size_measurements)
    ? details.size_measurements
    : [];

  let manualSize: string | null = null;
  if (Object.prototype.hasOwnProperty.call(details, "size")) {
    manualSize =
      typeof details.size === "string" && details.size.trim()
        ? details.size.trim()
        : null;
    setSelectedProductSize(manualSize);
  }

  const activeSize =
    manualSize ??
    (typeof selectedProductSize.value === "string"
      ? selectedProductSize.value
      : null);
  const colorSummary = colors.length ? checkoutStore.color : null;
  checkoutStore.setVariant({
    product: productSummary,
    color: colorSummary,
    size: activeSize,
    sizeMeasurements: Array.isArray(rawMeasurements) ? rawMeasurements : [],
  });
  checkoutStore.ensureMinimumQuantity();

  shirtLabRef.value?.updateClothing(details);
  // advance to Design step when a product is selected
  currentStep.value = 1;
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

function parseNullableNumber(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMediaMatch(
  media: any[],
  regex: RegExp,
  exclude?: string | null
) {
  if (!Array.isArray(media)) return null;
  const match = media.find((item: any) => {
    if (!item) return false;
    const text = item.classType ?? item.location ?? item.description ?? "";
    if (!regex.test(String(text))) return false;
    if (exclude && item.url === exclude) return false;
    return typeof item.url === "string" && item.url.length > 0;
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
  return (
    (candidates.find((url) => typeof url === "string" && url.length > 0) as
      | string
      | undefined) || null
  );
}

function resolveBackUrl(
  color: any,
  fallbackFront?: string | null
): string | null {
  if (!color) return fallbackFront ?? null;
  const media = Array.isArray(color.media) ? color.media : [];
  const candidates = [
    color.backUrl,
    color.backURL,
    color.back,
    resolveMediaMatch(media, /rear|back/i, fallbackFront ?? undefined),
    media.find(
      (item: any) => typeof item?.url === "string" && item.url !== fallbackFront
    )?.url,
    fallbackFront,
  ];
  return (
    (candidates.find((url) => typeof url === "string" && url.length > 0) as
      | string
      | undefined) || null
  );
}

function resolveSideUrl(
  color: any,
  fallbackFront?: string | null,
  fallbackBack?: string | null
): string | null {
  if (!color) return fallbackFront ?? fallbackBack ?? null;
  const media = Array.isArray(color.media) ? color.media : [];
  const candidates = [
    color.sideUrl,
    color.sideURL,
    color.side,
    color.sleeveUrl,
    resolveMediaMatch(
      media,
      /side|profile|left|right/i,
      fallbackFront ?? fallbackBack ?? undefined
    ),
    media.find(
      (item: any) =>
        typeof item?.url === "string" && /_(sd|d|s)_/i.test(item.url)
    )?.url,
    fallbackFront,
    fallbackBack,
  ];
  return (
    (candidates.find((url) => typeof url === "string" && url.length > 0) as
      | string
      | undefined) || null
  );
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
  const key = `${color.id ?? idx}|${front ?? ""}|${back ?? ""}|${side ?? ""}`;
  if (lastAppliedColorKey.value === key) return;

  const imagery: { front?: string; back?: string; side?: string } = {};
  if (front) imagery.front = front;
  if (back) imagery.back = back;
  if (side) imagery.side = side;
  if (front || back || side) {
    lab.setClothingImages?.(imagery);
  }

  if (color?.bgTransform || color?.backgroundTransform) {
    lab.setBackgroundTransform?.(
      color.bgTransform ?? color.backgroundTransform
    );
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
    hex:
      typeof color?.hex === "string" && color.hex
        ? color.hex
        : typeof color?.colorBackground === "string" && color.colorBackground
        ? color.colorBackground
        : typeof color?.color === "string" && color.color
        ? color.color
        : typeof color?.background === "string" && color.background
        ? color.background
        : null,
    price: parseNullableNumber(
      color?.price ?? color?.salePrice ?? color?.unitPrice
    ),
    currency:
      typeof color?.currency === "string" && color.currency
        ? color.currency
        : typeof color?.currencyCode === "string" && color.currencyCode
        ? color.currencyCode
        : null,
    quantityMin: parseNullableNumber(
      color?.quantityMin ?? color?.minimumQuantity ?? color?.minQty
    ),
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
  const initialIndex = defaultColorId
    ? normalized.findIndex((color: any) => color?.id === defaultColorId)
    : 0;
  setSelectedProductColorIndex(initialIndex >= 0 ? initialIndex : 0);
  applySelectedColorToShirtLab();
}

watch(productColors, () => {
  lastAppliedColorKey.value = null;
  applySelectedColorToShirtLab();
  syncCheckoutColor();
});

watch(
  () => selectedProductColorIndex.value,
  () => {
    applySelectedColorToShirtLab();
    syncCheckoutColor();
  }
);

watch(
  () => shirtLabRef.value,
  (lab) => {
    if (lab) {
      applySelectedColorToShirtLab();
      syncCheckoutColor();
    }
  }
);

watch(
  () => selectedProductSize.value,
  (size) => {
    checkoutStore.setSize(typeof size === "string" ? size : null);
  },
  { immediate: true }
);

syncCheckoutColor();

// Move to Checkout when checkout panel opens
watch(
  () => checkoutStore.isOpen,
  (open) => {
    if (open) currentStep.value = 2;
    else if (currentStep.value === 2) currentStep.value = 1;
  }
);
</script>

<style scoped>
.app-shell {
  position: relative;

  width: auto;

  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.app-shell__workspace {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  gap: 1rem;
}

.embed-wrapper {
  position: relative;

  overflow: hidden;
}

.embed-container {
  height: 560px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: aliceblue;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
  position: relative;
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
