<template>
  <div v-if="activeMenu" class="slide-menu">
    <div class="slide-menu-header">
      <button
        v-on:click="activeMenu === 'Text' ? fontPageRef?.backPage?.() : null"
        class="back-btn"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="3"
          stroke="currentColor"
          class="size-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
      </button>
      <span class="menu-title">{{ headerTitle }}</span>
      <button @click="closeMenu" class="close-btn">
        <CloseIcon />
      </button>
    </div>

    <div class="slide-menu-content">
      <!-- CLOTHING: only “Create New” + Create Form (no selection UI) -->

      <!-- UPLOAD -->
      <div v-if="activeMenu === 'Upload'">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onFileChange"
        />
        <div
          class="upload-container"
          @click="openFileDialog"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          :class="{ 'drag-hover': isDragging }"
        >
          <h3>High resolution artwork prints the best!</h3>
          <span
            >Lower than 300ppi artwork may result in a blurry print with
            pixelated edges.</span
          >
          <div class="upload-img-container">
            <img :src="uploadDark" class="upload-img" />
            <p>
              Drag and Drop or
              <a class="underlined">Browse</a>
              Your Computer
            </p>
          </div>
          <p>
            *Acceptable file types:
            <br />
            {{ allowedTypesDisplay }}*
            <br />
            (Max {{ maxFileSizeMB }}MB)
          </p>
        </div>
        <div class="upload-details">
          <h4>Having issues uploading your art?</h4>
          <p>
            If your file type is unsupported, or you're facing other problems
            trying to upload your design shoot us an email at
            <a style="color: #94c940"> cs@seeourdesigns.com.</a>
          </p>
          <p>
            Our team will review your file and follow up with you before
            processing your order!
          </p>
        </div>
        <div v-if="recentUploads.length" class="recent-uploads">
          <h4>Recently uploaded this session</h4>
          <div class="recent-uploads__grid">
            <button
              v-for="item in recentUploads"
              :key="item.uploadedAt + item.url"
              class="recent-uploads__thumb"
              type="button"
              @click.stop="reuseRecentUpload(item)"
            >
              <img :src="item.url" :alt="item.name" />
              <span class="recent-uploads__label">{{ item.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- PRODUCT COLORS -->
      <div v-else-if="activeMenu === 'Colors'" class="product-colors-tab">
        <div v-if="!productColors.length" class="color-status">
          No product colors loaded yet.
        </div>
        <div v-else class="product-colors-grid">
          <button
            v-for="(color, index) in productColors"
            :key="color.id || color.name || index"
            class="product-color-button"
            :class="{ 'is-selected': index === productColorIndex }"
            @click="handleProductColorClick(index)"
          >
            <span
              class="product-color-swatch"
              :style="swatchStyle(color)"
            ></span>
            <div class="product-color-meta">
              <span class="product-color-name">{{
                color.name || `Color ${index + 1}`
              }}</span>

              <div class="product-color-details">
                <span v-if="colorHasPrice(color)" class="product-color-price">{{
                  colorPriceLabel(color)
                }}</span>
                <span class="product-color-sizes">{{
                  colorSizesLabel(color)
                }}</span>
              </div>
            </div>
          </button>
        </div>
        <div
          class="product-size"
          :class="{ 'product-size--disabled': !availableSizes.length }"
        >
          <div class="product-size__header">
            <span class="product-size__label">Size</span>
            <span v-if="selectedProductSize" class="product-size__selection"
              >Selected: {{ selectedProductSize }}</span
            >
          </div>
          <div
            v-if="sizeAvailabilityNotice"
            class="product-size__notice"
            role="status"
            aria-live="polite"
          >
            {{ sizeAvailabilityNotice }}
          </div>
          <div v-if="availableSizes.length" class="product-size__slider">
            <WeightSlider
              v-model="sizeSliderIndex"
              :min="0"
              :max="availableSizes.length - 1"
              :step="1"
              :show-labels="false"
              class="product-size__weight-slider"
            />
            <div class="product-size__scale">
              <span
                v-for="(size, idx) in availableSizes"
                :key="size"
                :class="[
                  'product-size__scale-label',
                  { 'is-active': idx === activeSizeIndex },
                ]"
              >
                {{ size }}
              </span>
            </div>
          </div>
          <div v-else class="product-size__empty">
            Size information not available for this color.
          </div>
        </div>
      </div>

      <div v-else-if="activeMenu === 'Guide'" class="guide-panel">
        <div class="guide-panel__hero">
          <p class="guide-panel__eyebrow">Need a quick start?</p>
          <h3>How to use ShirtLab</h3>
          <p>
            Follow the steps below to pick a shirt, add artwork, and submit your
            custom order.
          </p>
        </div>
        <div class="guide-panel__steps">
          <article
            v-for="(step, index) in guideSteps"
            :key="step.title"
            class="guide-step"
          >
            <span class="guide-step__number">{{ index + 1 }}</span>
            <div>
              <h4>{{ step.title }}</h4>
              <p>{{ step.description }}</p>
            </div>
          </article>
        </div>
        <div class="guide-panel__tips">
          <h4>Pro tips</h4>
          <ul>
            <li v-for="tip in guideTips" :key="tip">{{ tip }}</li>
          </ul>
        </div>
      </div>

      <!-- TEXT -->
      <template v-else-if="activeMenu === 'Text'">
        <FontPage
          ref="fontPageRef"
          :selectedObject="selectedObject"
          :draw="draw"
          @uploadText="(payload: any) => emit('uploadObject', 'text', payload)"
          @center-text="$emit('center-text')"
          @duplicate-text="$emit('duplicate-text')"
          @bring-forward="$emit('bring-forward')"
          @send-back="$emit('send-back')"
        />
      </template>

      <!-- ICONS -->
      <div v-else-if="activeMenu === 'Icons'" id="iconMenu">
        <div v-if="isIconSelected" class="controls">
          <h4 class="controls__title">Icon Appearance</h4>

          <div class="shape-grid">
            <div class="shape-grid__style">
              <div class="controls__field">
                <label class="controls__label">Style</label>
                <div
                  class="shape-style-toggle"
                  :class="{
                    'shape-style-toggle--index-0': currentVariant === 'default',
                    'shape-style-toggle--index-1': currentVariant === 'outline',
                    'shape-style-toggle--index-2': currentVariant === 'rounded',
                  }"
                >
                  <button
                    v-for="variant in selectedIconVariants"
                    :key="variant"
                    class="shape-style-toggle__btn"
                    :class="{
                      'shape-style-toggle__btn--active':
                        currentVariant === variant,
                    }"
                    @click="currentVariant = variant"
                  >
                    {{ prettyVariant(variant) }}
                  </button>
                </div>
              </div>
            </div>

            <div class="shape-grid__colors">
              <div class="shape-color-pair">
                <div class="controls__field">
                  <label class="controls__label">Fill</label>
                  <input
                    type="color"
                    v-model="textColor"
                    class="shape-color-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="iconLib">
          <div class="search-bar">
            <input
              type="text"
              placeholder="Search Icons (e.g., home, star, person)"
              v-model="iconSearchQuery"
            />
            <span class="search-icon">🔍</span>
          </div>
          <div v-if="iconLoading" class="icon-status">Loading icons…</div>
          <div v-else-if="iconError" class="icon-status error">
            ⚠️ {{ iconError }}
          </div>
          <div v-else>
            <div v-if="filteredGroups.length === 0" class="icon-status">
              No icons found.
            </div>

            <div class="icon-grid">
              <button
                v-for="g in pagedGroups"
                :key="g.base"
                class="icon-tile"
                @click="chooseIcon(g)"
                :title="`${g.base} (${g.variants.join(', ')})`"
              >
                <div style="position: relative; display: inline-block">
                  <img
                    :src="iconUrl(pickEntryForPreview(g), 48)"
                    :alt="g.base"
                  />
                </div>

                <span class="icon-name">{{ g.base }}</span>
              </button>
            </div>

            <div v-if="filteredGroups.length > 0" class="icon-hint">
              Page {{ page }} · Showing {{ pagedGroups.length }} of
              {{ filteredGroups.length }} groups
            </div>

            <div class="pagination-controls">
              <button @click="prevPage" :disabled="page === 1">Prev</button>
              <button
                @click="nextPage"
                :disabled="page * pageSize >= filteredGroups.length"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- SHAPES TAB -->
      <div v-else-if="activeMenu === 'Shapes'" id="shapesMenu">
        <!-- SHAPE CONTROLS (show when a shape is selected) -->
        <div v-if="isShapeImageSelected" class="controls">
          <h4 class="controls__title">Shape Appearance</h4>

          <div class="shape-grid">
            <div class="shape-grid__style">
              <div class="controls__field">
                <label class="controls__label">Style</label>
                <div
                  class="shape-style-toggle"
                  :class="{
                    'shape-style-toggle--outline':
                      selectedShapeStyle === 'outline',
                  }"
                >
                  <button
                    class="shape-style-toggle__btn"
                    :class="{
                      'shape-style-toggle__btn--active':
                        selectedShapeStyle === 'filled',
                    }"
                    @click="selectedShapeStyle = 'filled'"
                  >
                    Filled
                  </button>
                  <button
                    class="shape-style-toggle__btn"
                    :class="{
                      'shape-style-toggle__btn--active':
                        selectedShapeStyle === 'outline',
                    }"
                    @click="selectedShapeStyle = 'outline'"
                  >
                    Outline
                  </button>
                </div>
              </div>
            </div>

            <div class="shape-grid__colors">
              <div class="shape-color-pair">
                <div
                  class="controls__field"
                  v-if="selectedShapeStyle === 'filled'"
                >
                  <label class="controls__label">Fill</label>
                  <input
                    type="color"
                    v-model="shapeFill"
                    class="shape-color-input"
                  />
                </div>
                <div class="controls__field">
                  <label class="controls__label">Stroke</label>
                  <input
                    type="color"
                    v-model="shapeStroke"
                    class="shape-color-input"
                  />
                </div>
              </div>
            </div>

            <div class="shape-grid__stroke">
              <div class="controls__field controls__field--wide">
                <label class="controls__label">Stroke width</label>
                <WeightSlider
                  v-model="shapeStrokeWidth"
                  :min="1"
                  :max="10"
                  :step="1"
                />
              </div>
            </div>
            <div class="shape-grid__detail" v-if="selectedShapeType === 'rect'">
              <div class="controls__field">
                <label class="controls__label">Corner radius</label>
                <div class="shape-slider-row">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    v-model.number="shapeCornerRadius"
                  />
                  <span class="shape-slider-value"
                    >{{ shapeCornerRadius }}px</span
                  >
                </div>
              </div>
            </div>

            <div
              class="shape-grid__detail"
              v-else-if="selectedShapeType === 'star'"
            >
              <div class="controls__field">
                <label class="controls__label">Points</label>

                <WeightSlider
                  v-model="shapePoints"
                  :min="5"
                  :max="12"
                  :step="1"
                  :show-labels="false"
                />
              </div>
            </div>

            <div
              class="shape-grid__detail"
              v-else-if="selectedShapeType === 'polygon'"
            >
              <div class="controls__field">
                <label class="controls__label">Sides</label>
                <WeightSlider
                  v-model="shapeSides"
                  :min="3"
                  :max="10"
                  :step="1"
                  leftLabel="3"
                  rightLabel="10"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="iconLib" ref="shapeScrollRef">
          <div class="search-bar">
            <input
              type="text"
              placeholder="Search Shapes (e.g., circle, star, arrow)"
              v-model="shapeSearchQuery"
            />
            <span class="search-icon">🔍</span>
          </div>

          <div v-if="filteredShapes.length === 0" class="icon-status">
            No shapes found.
          </div>

          <div class="virtual-wrap">
            <!-- top spacer to keep scroll height correct -->
            <div :style="{ height: shapeTopSpacer + 'px' }"></div>

            <!-- only render the visible window -->
            <div class="icon-grid">
              <button
                v-for="s in visibleShapes"
                :key="s.key"
                class="icon-tile"
                @click="chooseShape(s)"
                :title="s.label"
              >
                <div style="position: relative; display: inline-block">
                  <img
                    :src="shapePreviewUrl(s)"
                    alt=""
                    width="32"
                    height="32"
                  />
                </div>
                <span class="icon-name">{{ s.label }}</span>
              </button>
            </div>

            <!-- bottom spacer -->
            <div :style="{ height: shapeBottomSpacer + 'px' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Autofill prompt -->
  <div v-if="autofillPrompt" class="custom-block">
    <span>Autofill?</span>
    <div>
      <p>{{ autofillPrompt }}</p>
      <button
        class="autofill-btn yes"
        @click="
          () => {
            selectedBrand = ssactivewearBrand;
            newClothingName = ssactivewearStyle;
            showBrandSuggestions = false;
            autofillPrompt = '';
          }
        "
      >
        Yes
      </button>
      <button class="autofill-btn no" @click="autofillPrompt = ''">No</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/* =========================================================
     IMPORTS
     =======================================================*/
import {
  ref,
  computed,
  watch,
  watchEffect,
  onMounted,
  onBeforeUnmount,
  toRef,
  nextTick,
  type Ref,
} from "vue";
import CloseIcon from "vue-material-design-icons/Close.vue";
import uploadDark from "./assets/uploadDark.png";

import FontPage from "./FontPage.vue";

import { supabase } from "../../supabase";
import type { ImageObject, TextObject } from "../shirtlab/types";
import {
  PRODUCT_COLORS,
  selectedProductColorIndex,
  setSelectedProductColorIndex,
  selectedProductSize,
  setSelectedProductSize,
  extractColorSizes,
  findMatchingSize,
  normalizeSizeToken,
} from "./types/colorList";
import WeightSlider from "./TextAssets/WeightSlider.vue";

const guideSteps = [
  {
    title: "Select your garment",
    description:
      "Open the Product Colors panel to load available shirts, pick a color, update size, and lock in the base before you design.",
  },
  {
    title: "Build your artwork",
    description:
      "Upload high-resolution files or add text, icons, and shapes; use the alignment shortcuts to keep everything centered and layered correctly.",
  },
  {
    title: "Preview & checkout",
    description:
      "Review the preview in the summary card, set quantity, add to cart, and complete checkout when everything looks perfect.",
  },
];

const guideTips = [
  "Upload artwork that is 300ppi or higher and uses transparent backgrounds when possible for crisp prints.",
  "Use the center, duplicate, bring forward, and send back controls to keep multi-layered designs tidy.",
  "Re-open the Product Colors panel anytime to confirm size availability or swap colors mid-design.",
];

/* =========================================================
     PROPS & EMITS
     =======================================================*/
const emit = defineEmits<{
  (e: "closeMenu"): void;
  (e: "uploadObject", type: string, payload: any): void;
  (e: "center-text"): void;
  (e: "duplicate-text"): void;
  (e: "bring-forward"): void;
  (e: "send-back"): void;
  (e: "shape-style", style: "filled" | "outline"): void;
}>();

const props = defineProps<{
  activeMenu: string;
  headerTitle: string;
  selectedObject: TextObject | ImageObject | any | null;
  draw: () => void;
}>();

// make the prop reactive (and typed)
const selectedObject = toRef(props, "selectedObject") as Ref<
  TextObject | ImageObject | any | null
>;

watch(
  selectedObject,
  (val) => {
    console.log("[MenuContent/watch] selectedObject ->", val);
  },
  { immediate: true }
);

watchEffect(() => {
  console.log(
    "[MenuContent/watchEffect] selectedObject ->",
    selectedObject.value
  );
});

/* =========================================================
     GLOBAL UI STATE
     =======================================================*/
const isDragging = ref(false);
const fontPageRef = ref();
type RecentUpload = {
  url: string;
  name: string;
  isVector: boolean;
  uploadedAt: number;
};
const recentUploads = ref<RecentUpload[]>([]);

const RECENT_UPLOADS_KEY = "shirtlab:recent-uploads";

function loadRecentUploadsFromSession() {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined")
    return;
  try {
    const raw = sessionStorage.getItem(RECENT_UPLOADS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      recentUploads.value = parsed
        .filter((x) => x && typeof x.url === "string")
        .slice(0, 12);
    }
  } catch {
    // ignore
  }
}

function persistRecentUploads() {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined")
    return;
  try {
    sessionStorage.setItem(
      RECENT_UPLOADS_KEY,
      JSON.stringify(recentUploads.value)
    );
  } catch {
    // ignore
  }
}

function addRecentUpload(entry: {
  url: string;
  name: string;
  isVector: boolean;
}) {
  const now = Date.now();
  const existing = recentUploads.value.filter((x) => x.url !== entry.url);
  recentUploads.value = [
    {
      url: entry.url,
      name: entry.name,
      isVector: entry.isVector,
      uploadedAt: now,
    },
    ...existing,
  ].slice(0, 12);
  persistRecentUploads();
}

function reuseRecentUpload(item: RecentUpload) {
  const isSvg = item.isVector;
  const variant = isSvg ? "svg" : "bitmap";
  emit("uploadObject", "image", {
    imgUrl: item.url,
    elementType: "image",
    elementVariant: variant,
    name: item.name,
    isVector: isSvg,
  });
}

/* =========================================================
     ICONS PANEL (Iconify)
     =======================================================*/
type VariantKey =
  | "default"
  | "outlined"
  | "filled"
  | "rounded"
  | "round"
  | "sharp"
  | "twotone"
  | "two-tone"
  | "outline";

const iconPrefix = "mdi";

const suffixToVariant: Record<string, VariantKey> = {
  outlined: "outlined",
  outline: "outline",
  filled: "filled",
  rounded: "rounded",
  round: "round",
  sharp: "sharp",
  twotone: "twotone",
  "two-tone": "two-tone",
};

const previewPreference: VariantKey[] = [
  "default",
  "filled",
  "outlined",
  "rounded",
  "round",
  "sharp",
  "twotone",
  "two-tone",
  "outline",
];

const currentVariant = ref<VariantKey>("default");
const syncingVariantFromSelection = ref(false);

const iconSearchQuery = ref<string>("");
const iconLoading = ref(false);
const iconError = ref<string | null>(null);

const iconNames = ref<string[]>([]);

function parseIconFromUrl(url: string): { prefix?: string; full?: string } {
  try {
    const m = url.match(/api\.iconify\.design\/([^/]+)\/([^/?]+)\.svg/i);
    if (m) return { prefix: m[1], full: m[2] };
  } catch {
    /* noop */
  }
  return {};
}

function parseIconFromAny(so: any): { prefix?: string; full?: string } {
  // 1) Try URL first
  const byUrl = parseIconFromUrl(so?.imgUrl || so?.src || "");
  if (byUrl.full) return byUrl;

  if (so?.elementType === "icon" && typeof so.elementVariant === "string") {
    const variant = so.elementVariant;
    if (variant.includes(":")) {
      const [p, rest] = variant.split(":");
      if (p && rest) return { prefix: p, full: rest };
    }
    return { prefix: undefined, full: variant };
  }

  // 2) Fallback to name like "mdi:home" or "material-symbols:star-outline"
  if (typeof so?.name === "string" && so.name.includes(":")) {
    const [p, rest] = so.name.split(":");
    if (p && rest) return { prefix: p, full: rest };
  }

  return {};
}

const SHAPE_ID_PREFIX = "shape";

function parseShapeFromUrl(url: string): { key?: string } {
  try {
    if (!url || typeof url !== "string") return {};
    // Look for fragment metadata like #shape=rect
    const frag = url.split("#")[1] || "";
    if (frag) {
      const qs = frag.startsWith("?") ? frag.slice(1) : frag;
      const params = new URLSearchParams(qs);
      const key = params.get("shape") || params.get("shapeKey");
      if (key) return { key };
    }
    // Also allow query param ?shape=rect just in case
    const q = url.split("?")[1] || "";
    if (q) {
      const params = new URLSearchParams(q);
      const key = params.get("shape") || params.get("shapeKey");
      if (key) return { key };
    }
  } catch {
    /* noop */
  }
  return {};
}

function parseShapeFromAny(so: any): {
  key?: string;
  type?: ShapeType;
  meta?: Partial<ShapeMeta>;
} {
  if (!so) return {};

  // 1) Prefer existing meta
  if (so.shapeMeta && typeof so.shapeMeta === "object") {
    const key = (so.shapeMeta.key as string) || undefined;
    const type = (so.shapeMeta.shapeType as ShapeType) || undefined;
    return { key, type, meta: so.shapeMeta };
  }

  if (so?.elementType === "shape" && typeof so.elementVariant === "string") {
    const key = so.elementVariant;
    const item = SHAPES.find((s) => s.key === key);
    return { key, type: item?.type, meta: so.shapeMeta };
  }

  // 2) Name like "shape:rect"
  if (
    typeof so.name === "string" &&
    so.name.startsWith(`${SHAPE_ID_PREFIX}:`)
  ) {
    const key = so.name.slice(SHAPE_ID_PREFIX.length + 1);
    const item = SHAPES.find((s) => s.key === key);
    return { key, type: item?.type };
  }

  // 3) Data URL with fragment #shape=
  const url =
    typeof so.imgUrl === "string"
      ? so.imgUrl
      : typeof so.src === "string"
      ? so.src
      : "";
  const byUrl = parseShapeFromUrl(url);
  if (byUrl.key) {
    const item = SHAPES.find((s) => s.key === byUrl.key);
    return { key: byUrl.key, type: item?.type };
  }

  return {};
}

const selectedIconInfo = computed(() => {
  const so = selectedObject.value as any;
  if (!so || so.type !== "image") return null;
  // ignore shapes masquerading as images
  if (
    so.elementType === "shape" ||
    so.shapeMeta ||
    (typeof so.name === "string" && so.name.startsWith("shape:"))
  )
    return null;

  const { full, prefix } = parseIconFromAny(so);
  if (!full) return null;

  const parts = full.split("-");
  const last = parts[parts.length - 1];
  const variant: VariantKey = suffixToVariant[last] ?? "default";
  const base = variant === "default" ? full : parts.slice(0, -1).join("-");
  return { prefix, full, base, variant };
});

type IconGroup = {
  base: string;
  entries: { variant: VariantKey; full: string }[];
  variants: VariantKey[];
};

const iconGroups = computed<IconGroup[]>(() => {
  const map = new Map<string, IconGroup>();
  for (const full of iconNames.value) {
    const parts = full.split("-");
    const last = parts[parts.length - 1];
    const variant: VariantKey = suffixToVariant[last] ?? "default";
    const base = variant === "default" ? full : parts.slice(0, -1).join("-");

    let g = map.get(base);
    if (!g) {
      g = { base, entries: [], variants: [] };
      map.set(base, g);
    }
    g.entries.push({ variant, full });
    if (!g.variants.includes(variant)) g.variants.push(variant);
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) => a.base.localeCompare(b.base));
  return groups;
});

const selectedGroup = computed(() => {
  if (!selectedIconInfo.value) return null;
  return (
    iconGroups.value.find((g) => g.base === selectedIconInfo.value!.base) ||
    null
  );
});

const showSwatchPanel = ref(false);

function closeSwatchPanel() {
  showSwatchPanel.value = false;
}

const selectedIconVariants = computed<VariantKey[]>(
  () => selectedGroup.value?.variants ?? ["default"]
);

function prettyVariant(v: VariantKey) {
  switch (v) {
    case "twotone":
      return "TwoTone";
    case "two-tone":
      return "Two-Tone";
    case "round":
      return "Round";
    default:
      return v[0].toUpperCase() + v.slice(1);
  }
}

const filteredGroups = computed(() => {
  const q = (iconSearchQuery.value || "").toLowerCase().trim();
  const baseMap = (g: IconGroup) => {
    const def = g.entries.find((e) => e.variant === "default");
    return def ? { ...g, entries: [def] } : g;
  };
  return (
    q ? iconGroups.value.filter((g) => g.base.includes(q)) : iconGroups.value
  ).map(baseMap);
});

const page = ref(1);
const pageSize = 100;

const pagedGroups = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredGroups.value.slice(start, start + pageSize);
});

function nextPage() {
  if (page.value * pageSize < filteredGroups.value.length) page.value++;
}
function prevPage() {
  if (page.value > 1) page.value--;
}
watch(iconSearchQuery, () => (page.value = 1));

// swatch drawer global listeners
const swatchDrawerRef = ref<HTMLElement | null>(null);
function onGlobalPointerDown(e: PointerEvent) {
  if (!showSwatchPanel.value) return;
  const el = swatchDrawerRef.value;
  if (!el) return;
  if (el.contains(e.target as Node)) return;
  closeSwatchPanel();
}
function onKeydown(e: KeyboardEvent) {
  if (showSwatchPanel.value && (e.key === "Escape" || e.key === "Esc")) {
    e.preventDefault();
    closeSwatchPanel();
  }
}

onMounted(() => {
  window.addEventListener("pointerdown", onGlobalPointerDown, true);
  window.addEventListener("keydown", onKeydown);
  if (props.activeMenu === "Icons") loadIconsOnce();
});
onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", onGlobalPointerDown, true);
  window.removeEventListener("keydown", onKeydown);
});

watch(
  () => props.activeMenu,
  (val) => {
    if (val === "Icons") loadIconsOnce();
  },
  { immediate: true }
);

watch(
  [selectedIconInfo, iconGroups],
  ([info, groups]) => {
    if (!info) return;
    const g = groups.find((gr) => gr.base === info.base);
    if (!g) return;
    syncingVariantFromSelection.value = true;
    currentVariant.value = g.variants.includes(info.variant)
      ? info.variant
      : previewPreference.find((v) => g.variants.includes(v)) ?? g.variants[0];
    queueMicrotask(() => {
      syncingVariantFromSelection.value = false;
    });
  },
  { immediate: true }
);

watch(
  currentVariant,
  (v) => {
    if (syncingVariantFromSelection.value) return;
    const g = selectedGroup.value;
    const so = selectedObject.value as any;
    if (!so || so.type !== "image" || !g) return;

    const entry =
      g.entries.find((e) => e.variant === v) ||
      g.entries.find((e) => e.variant === "default") ||
      g.entries[0];
    if (!entry) return;

    const chosenPrefix = selectedIconInfo.value?.prefix || iconPrefix;
    const friendly = friendlyIconLabel(g.base);

    (async () => {
      const newUrl = await buildTrimmedIconDataUrl(
        chosenPrefix,
        entry.full,
        1024,
        textColor.value || undefined
      );
      applyIconImage(so, {
        url: newUrl,
        prefix: chosenPrefix,
        full: entry.full,
        friendlyName: friendly,
      });
    })().catch((error) => {
      console.warn("[Icons] Failed to update icon variant", { entry, error });
    });
  },
  { flush: "post" }
);

/* ---------------------------------------------------------
     Loader — ONE fetch (with fallback)
     -------------------------------------------------------*/
async function loadIconsOnce() {
  if (iconLoading.value || iconNames.value.length) return;
  iconLoading.value = true;
  iconError.value = null;

  try {
    // 1) primary: /{prefix}.json → has `icons` map
    const url1 = `https://api.iconify.design/${iconPrefix}.json`;
    const r1 = await fetch(url1);
    if (!r1.ok) throw new Error(`HTTP ${r1.status} @ ${url1}`);
    const j1 = await r1.json();

    let names: string[] = Object.keys(j1?.icons || []);

    // 2) fallback: /collection?prefix=... → flatten categories arrays
    if (!names.length) {
      const url2 = `https://api.iconify.design/collection?prefix=${iconPrefix}`;
      const r2 = await fetch(url2);
      if (!r2.ok) throw new Error(`HTTP ${r2.status} @ ${url2}`);
      const j2 = await r2.json();

      const catNames: string[] = [];
      if (j2?.categories && typeof j2.categories === "object") {
        for (const arr of Object.values<string[]>(j2.categories))
          catNames.push(...arr);
      }
      if (Array.isArray(j2?.uncategorized)) catNames.push(...j2.uncategorized);

      names = Array.from(new Set(catNames));
    }

    if (!names.length) {
      throw new Error(
        `No icons found for prefix "${iconPrefix}". If you meant Google Material Symbols, set iconPrefix = "material-symbols".`
      );
    }

    iconNames.value = names.sort();
    page.value = 1;
    console.log("[Icons] loaded", iconPrefix, iconNames.value.length, "names");
  } catch (err: any) {
    iconError.value = err?.message || "Failed to load icons";
    console.error("[Icons] load error:", err);
  } finally {
    iconLoading.value = false;
  }
}

onMounted(() => {
  if (props.activeMenu === "Icons") loadIconsOnce();
});
watch(
  () => props.activeMenu,
  (val) => {
    if (val === "Icons") loadIconsOnce();
  },
  { immediate: true }
);

// choose the actual name to preview for a group (default-first)
function pickEntryForPreview(g: IconGroup): string {
  const exact = g.entries.find((e) => e.variant === "default");
  if (exact) return exact.full;
  for (const v of previewPreference) {
    const found = g.entries.find((e) => e.variant === v);
    if (found) return found.full;
  }
  return g.entries[0]?.full || g.base;
}

// build URL from the full icon name (current collection)
function iconUrl(fullName: string, size = 48) {
  return `https://api.iconify.design/${iconPrefix}/${fullName}.svg?height=${size}`;
}

// click → place selected variant if exists else fallback
async function chooseIcon(g: IconGroup) {
  const name = pickEntryForPreview(g);
  const variantId = `${iconPrefix}:${name}`;
  const friendlyName = friendlyIconLabel(g.base);
  const imgUrl = await buildTrimmedIconDataUrl(
    iconPrefix,
    name,
    1024,
    textColor.value || undefined
  );
  emit("uploadObject", "image", {
    imgUrl,
    isVector: true,
    elementType: "icon",
    elementVariant: variantId,
    name: friendlyName,
  });
}

/* =========================================================
     SHAPES TAB — catalog, search (debounced), virtualization, controls
     =======================================================*/

type ShapeType =
  | "rect"
  | "circle"
  | "ellipse"
  | "triangle"
  | "star"
  | "arrow"
  | "polygon"
  | "heart"
  | "line"
  | "path";

type ShapeItem = {
  key: string;
  label: string;
  type: ShapeType; // matches template v-ifs
  previewPoints?: string; // for polygons/stars (100x100 coord space)
  previewPath?: string; // for path-based shapes (100x100 coord space)
  init?: Partial<{
    points: number; // stars
    sides: number; // polygons
    cornerRadius: number; // rect/square
    style: "filled" | "outline";
  }>;
};

// helpers to build previews
function polygonPoints(
  sides: number,
  r: number,
  cx: number,
  cy: number,
  rotRad = -Math.PI / 2
): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotRad + (i * 2 * Math.PI) / sides;
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(
        2
      )}`
    );
  }
  return pts.join(" ");
}
function starPoints(
  n: number,
  r1: number,
  r2: number,
  cx: number,
  cy: number
): string {
  const pts: string[] = [];
  const step = Math.PI / n;
  let a = -Math.PI / 2;
  for (let i = 0; i < 2 * n; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(
        2
      )}`
    );
    a += step;
  }
  return pts.join(" ");
}

// simple paths for preview (100x100)
const HEART_PATH =
  "M50 82 C 20 62, 12 40, 26 28 C 36 20, 50 24, 50 34 C 50 24, 64 20, 74 28 C 88 40, 80 62, 50 82 Z";
const ARROW_RIGHT = "M20 50 H70 M55 35 L70 50 L55 65";
const ARROW_LEFT = "M80 50 H30 M45 35 L30 50 L45 65";
const ARROW_UP = "M50 80 V30 M35 45 L50 30 L65 45";
const ARROW_DOWN = "M50 20 V70 M35 55 L50 70 L65 55";
const CHECK_PATH = "M22 52 L42 72 L78 28";
const CROSS_PATH = "M28 28 L72 72 M72 28 L28 72";
const PLUS_PATH = "M50 20 V80 M20 50 H80";
const CLOUD_PATH =
  "M32 70 H70 a14 14 0 0 0 0 -28 a16 16 0 0 0 -31 -5 a12 12 0 0 0 -3 23 z";
const BUBBLE_PATH =
  "M22 32 h56 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-24 l-14 12 v-12 h-18 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z";

const SHAPES: ShapeItem[] = [
  { key: "rect", label: "Rectangle", type: "rect", init: { cornerRadius: 12 } },
  { key: "square", label: "Square", type: "rect", init: { cornerRadius: 12 } },
  { key: "circle", label: "Circle", type: "circle" },
  { key: "ellipse", label: "Ellipse", type: "ellipse" },
  { key: "triangle", label: "Triangle", type: "triangle" },

  {
    key: "diamond",
    label: "Diamond",
    type: "polygon",
    previewPoints: polygonPoints(4, 34, 50, 50, Math.PI / 4),
    init: { sides: 4 },
  },
  {
    key: "pentagon",
    label: "Pentagon",
    type: "polygon",
    previewPoints: polygonPoints(5, 34, 50, 50),
    init: { sides: 5 },
  },
  {
    key: "hexagon",
    label: "Hexagon",
    type: "polygon",
    previewPoints: polygonPoints(6, 34, 50, 50),
    init: { sides: 6 },
  },
  {
    key: "octagon",
    label: "Octagon",
    type: "polygon",
    previewPoints: polygonPoints(8, 32, 50, 50),
    init: { sides: 8 },
  },

  {
    key: "star5",
    label: "Star (5)",
    type: "star",
    previewPoints: starPoints(5, 34, 15, 50, 50),
    init: { points: 5 },
  },
  {
    key: "star6",
    label: "Star (6)",
    type: "star",
    previewPoints: starPoints(6, 34, 16, 50, 50),
    init: { points: 6 },
  },

  { key: "heart", label: "Heart", type: "heart", previewPath: HEART_PATH },

  {
    key: "arrow-right",
    label: "Arrow →",
    type: "arrow",
    previewPath: ARROW_RIGHT,
  },
  {
    key: "arrow-left",
    label: "Arrow ←",
    type: "arrow",
    previewPath: ARROW_LEFT,
  },
  { key: "arrow-up", label: "Arrow ↑", type: "arrow", previewPath: ARROW_UP },
  {
    key: "arrow-down",
    label: "Arrow ↓",
    type: "arrow",
    previewPath: ARROW_DOWN,
  },

  {
    key: "line-h",
    label: "Line —",
    type: "path",
    previewPath: "M20 50 H80",
    init: { style: "outline" },
  },
  {
    key: "line-v",
    label: "Line |",
    type: "path",
    previewPath: "M50 20 V80",
    init: { style: "outline" },
  },
  {
    key: "plus",
    label: "Plus",
    type: "path",
    previewPath: PLUS_PATH,
    init: { style: "outline" },
  },
  {
    key: "cross",
    label: "Cross",
    type: "path",
    previewPath: CROSS_PATH,
    init: { style: "outline" },
  },
  {
    key: "check",
    label: "Check",
    type: "path",
    previewPath: CHECK_PATH,
    init: { style: "outline" },
  },

  { key: "cloud", label: "Cloud", type: "path", previewPath: CLOUD_PATH },
  {
    key: "chat-bubble",
    label: "Chat Bubble",
    type: "path",
    previewPath: BUBBLE_PATH,
  },
];

/* ---------- NEW: helpers to generate an SVG image (data URL) ---------- */

// ---- ICON COLOR STATE + HELPERS ----
// shows "None" or the color's friendly name

const textColor = ref<string>(""); // '' = no override (use icon's default)

function buildIconApiUrl(
  prefix: string,
  fullName: string,
  size = 48,
  color?: string
) {
  let u = `https://api.iconify.design/${prefix}/${fullName}.svg?height=${size}`;
  if (color && color !== "none") u += `&color=${encodeURIComponent(color)}`;
  return u;
}

function friendlyIconLabel(base: string): string {
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function buildTrimmedIconDataUrl(
  prefix: string,
  fullName: string,
  size = 1024,
  color?: string
): Promise<string> {
  const apiUrl = buildIconApiUrl(prefix, fullName, size, color);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const markup = await response.text();
    const trimmed = trimSvgWhitespace(markup);
    // Icons should behave as true icons, not shapes; do not embed a #shape= fragment
    return svgDataUrl(trimmed);
  } catch (error) {
    console.warn("[Icons] Failed to trim icon SVG; using original URL.", {
      prefix,
      fullName,
      error,
    });
    return apiUrl;
  }
}

function applyIconImage(
  so: any,
  payload: { url: string; prefix: string; full: string; friendlyName: string }
) {
  so.imgUrl = payload.url;
  so.isVector = true;
  so.elementType = "icon";
  so.elementVariant = `${payload.prefix}:${payload.full}`;
  so.name = payload.friendlyName;

  if (so.img && typeof so.img === "object") {
    so.img.onload = () => props.draw();
    so.img.crossOrigin = "anonymous";
    so.img.src = payload.url;
  } else {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => props.draw();
    img.src = payload.url;
    so.img = img;
  }
}

async function applySelectedIconColor() {
  const so = selectedObject.value as any;
  const info = selectedIconInfo.value;
  if (!so || !info) return; // nothing selected or not an icon

  const chosenPrefix = info.prefix || iconPrefix;
  const friendly = friendlyIconLabel(info.base);
  const newUrl = await buildTrimmedIconDataUrl(
    chosenPrefix,
    info.full!,
    1024,
    textColor.value || undefined
  );

  applyIconImage(so, {
    url: newUrl,
    prefix: chosenPrefix,
    full: info.full!,
    friendlyName: friendly,
  });
}

// whenever the swatch changes, recolor the selected icon
watch(textColor, () => {
  void applySelectedIconColor();
});

// optional: when selection changes, try to sync textColor from URL (?color=...)
function parseColorParam(url: string): string {
  try {
    if (!url || url.startsWith("data:")) return "";
    const q = url.split("?")[1] || "";
    const p = new URLSearchParams(q);
    const c = p.get("color");
    return c ? decodeURIComponent(c) : "";
  } catch {
    return "";
  }
}
watch(selectedObject, (so) => {
  if (!so || typeof so.imgUrl !== "string") return;
  textColor.value = parseColorParam(so.imgUrl || "");
});

type ShapeMeta = {
  key: string;
  shapeType: ShapeType;
  style: "filled" | "outline";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  points: number;
  sides: number;
  width: number; // output image size
  height: number; // output image size
  // optional: for path/polygon we can reuse preview data
  previewPath?: string;
  previewPoints?: string;
};
type ArrowDir = "right" | "left" | "up" | "down";

/** 0..100 coords; insetU = half-stroke (in 0..100 units) */
function arrowPoints(
  dir: ArrowDir,
  insetU = 0,
  shaftPct = 26, // thickness of the shaft (% of height/width)
  headLenPct = 28, // how long the head is
  headWidthScale = 1.6 // how wide the head is vs shaft
): string {
  const c = 50;
  const halfT = shaftPct / 2;
  const headLen = headLenPct;
  const headHalfW = halfT * headWidthScale;

  switch (dir) {
    case "right": {
      const L = insetU,
        R = 100 - insetU,
        base = R - headLen;
      return `${L},${c - halfT} ${base},${c - halfT} ${base},${
        c - headHalfW
      } ${R},${c} ${base},${c + headHalfW} ${base},${c + halfT} ${L},${
        c + halfT
      }`;
    }
    case "left": {
      const L = insetU,
        R = 100 - insetU,
        base = L + headLen;
      return `${R},${c - halfT} ${base},${c - halfT} ${base},${
        c - headHalfW
      } ${L},${c} ${base},${c + headHalfW} ${base},${c + halfT} ${R},${
        c + halfT
      }`;
    }
    case "up": {
      const T = insetU,
        B = 100 - insetU,
        base = T + headLen;
      return `${50 - halfT},${B} ${50 - halfT},${base} ${
        50 - headHalfW
      },${base} 50,${T} ${50 + headHalfW},${base} ${50 + halfT},${base} ${
        50 + halfT
      },${B}`;
    }
    default: {
      // 'down'
      const T = insetU,
        B = 100 - insetU,
        base = B - headLen;
      return `${50 - halfT},${T} ${50 - halfT},${base} ${
        50 - headHalfW
      },${base} 50,${B} ${50 + headHalfW},${base} ${50 + halfT},${base} ${
        50 + halfT
      },${T}`;
    }
  }
}

function escXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function svgDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function svgDataUrlWithId(svg: string, shapeKey: string) {
  // Append a fragment so we can recover identity later
  return `${svgDataUrl(svg)}#shape=${encodeURIComponent(shapeKey)}`;
}
function scaleNumbers(str: string, scale: number): string {
  return str.replace(/-?\d*\.?\d+/g, (n) => (parseFloat(n) * scale).toFixed(2));
}
function shapePreviewUrl(s: ShapeItem): string {
  // defaults
  let style: "filled" | "outline" = (s.init?.style ?? "filled") as any;
  let strokeWidth = 2;

  // force outline + thicker stroke for path-based shapes
  if (["plus", "cross", "check", "line-h", "line-v"].includes(s.key)) {
    style = "outline";
    strokeWidth = 6;
  }

  const meta: ShapeMeta = {
    key: s.key,
    shapeType: s.type,
    style,
    fill: "#000000",
    stroke: "#000000",
    strokeWidth,
    cornerRadius: s.init?.cornerRadius ?? 12,
    points: s.init?.points ?? 5,
    sides: s.init?.sides ?? (s.type === "polygon" ? 6 : 0),
    width: 100,
    height: 100,
    previewPath: s.previewPath,
    previewPoints: s.previewPoints,
  };
  return svgDataUrl(svgFromShapeMeta(meta));
}
function svgFromShapeMeta(m: ShapeMeta): string {
  const W = m.width || 512;
  const H = m.height || 512;
  const scale = W / 100;
  const insetU = m.style === "outline" ? m.strokeWidth / 2 / scale : 0;

  const hasStroke =
    typeof m.strokeWidth === "number" && m.strokeWidth > 0 ? true : false;
  const fillAttr =
    m.style === "filled" ? `fill="${escXml(m.fill)}"` : `fill="none"`;
  const strokeAttr = hasStroke
    ? `stroke="${escXml(m.stroke)}" stroke-width="${
        m.strokeWidth
      }" stroke-linecap="round" stroke-linejoin="round"`
    : `stroke="none"`;
  const common = `${fillAttr} ${strokeAttr}`;

  let inner = "";
  let useUnitViewBox = false;

  switch (m.shapeType) {
    case "rect": {
      const x = insetU;
      const y = insetU;
      const w = 100 - insetU * 2;
      const h = 100 - insetU * 2;
      const rx = Math.max(0, m.cornerRadius ?? 0);
      inner = `<rect x="${(x * scale).toFixed(2)}" y="${(y * scale).toFixed(
        2
      )}" width="${(w * scale).toFixed(2)}" height="${(h * scale).toFixed(
        2
      )}" rx="${(rx * scale).toFixed(2)}" ry="${(rx * scale).toFixed(
        2
      )}" ${common} />`;
      break;
    }
    case "circle": {
      const r = 50 - insetU;
      inner = `<circle cx="${(50 * scale).toFixed(2)}" cy="${(
        50 * scale
      ).toFixed(2)}" r="${(r * scale).toFixed(2)}" ${common} />`;
      break;
    }
    case "ellipse": {
      const rx = 50 - insetU;
      const ry = 40 - insetU;
      inner = `<ellipse cx="${(50 * scale).toFixed(2)}" cy="${(
        50 * scale
      ).toFixed(2)}" rx="${(rx * scale).toFixed(2)}" ry="${(ry * scale).toFixed(
        2
      )}" ${common} />`;
      break;
    }
    case "triangle": {
      const mU = insetU;
      const pts = `${50},${mU} ${100 - mU},${100 - mU} ${mU},${100 - mU}`;
      inner = `<polygon points="${escXml(
        scaleNumbers(pts, scale)
      )}" ${common} />`;
      break;
    }
    case "polygon": {
      const R = 50 - insetU;
      const pts = polygonPoints(m.sides || 6, R, 50, 50);
      inner = `<polygon points="${escXml(
        scaleNumbers(pts, scale)
      )}" ${common} />`;
      break;
    }
    case "star": {
      const R = 50 - insetU;
      const r = R * 0.45;
      const pts = starPoints(m.points || 5, R, r, 50, 50);
      inner = `<polygon points="${escXml(
        scaleNumbers(pts, scale)
      )}" ${common} />`;
      break;
    }
    case "arrow": {
      const key = (m.key || "").toLowerCase();
      const dir: ArrowDir = key.includes("left")
        ? "left"
        : key.includes("up")
        ? "up"
        : key.includes("down")
        ? "down"
        : "right";
      const pts = arrowPoints(dir, insetU);
      inner = `<polygon points="${escXml(
        scaleNumbers(pts, scale)
      )}" ${common} />`;
      break;
    }
    case "heart":
    case "line":
    case "path": {
      const d = m.previewPath || "M20 50 H80";
      inner = `<path d="${escXml(d)}" ${common} />`;
      useUnitViewBox = true;
      break;
    }
    default: {
      const d = m.previewPath || "M0 50 H100";
      inner = `<path d="${escXml(d)}" ${common} />`;
      useUnitViewBox = true;
    }
  }

  const vb = useUnitViewBox ? `0 0 100 100` : `0 0 ${W} ${H}`;
  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${W}" height="${H}">${inner}</svg>`;
  return trimSvgWhitespace(rawSvg, {
    useUnitViewBox,
    baseWidth: W,
    baseHeight: H,
    // Pad by at least 10px, but increase with stroke width
    paddingPx: Math.max(10, m.strokeWidth || 0),
  });
}

function trimSvgWhitespace(
  svgMarkup: string,
  options?: {
    useUnitViewBox?: boolean;
    baseWidth?: number;
    baseHeight?: number;
    /** Optional extra padding (in final pixels) around the tight crop */
    paddingPx?: number;
  }
): string {
  if (
    typeof document === "undefined" ||
    typeof DOMParser === "undefined" ||
    !document.body
  ) {
    return svgMarkup;
  }

  const parseLength = (raw: string | null): number | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
    if (!match) return null;
    const num = Number.parseFloat(match[1]);
    return Number.isFinite(num) ? num : null;
  };

  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(svgMarkup, "image/svg+xml");
    const svgEl = parsed.documentElement;
    if (!svgEl || svgEl.nodeName.toLowerCase() !== "svg") {
      return svgMarkup;
    }

    const originalViewBoxAttr = svgEl.getAttribute("viewBox");
    let originalViewBoxWidth: number | null = null;
    let originalViewBoxHeight: number | null = null;
    if (originalViewBoxAttr) {
      const parts = originalViewBoxAttr.trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        originalViewBoxWidth = parts[2];
        originalViewBoxHeight = parts[3];
      }
    }

    const originalWidth = parseLength(svgEl.getAttribute("width"));
    const originalHeight = parseLength(svgEl.getAttribute("height"));

    const imported = document.importNode(
      svgEl,
      true
    ) as unknown as SVGSVGElement;
    imported.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    imported.style.position = "absolute";
    imported.style.visibility = "hidden";
    imported.style.pointerEvents = "none";
    imported.style.width = "0";
    imported.style.height = "0";
    document.body.appendChild(imported);

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    try {
      const graphics = Array.from(
        imported.querySelectorAll("*")
      ) as SVGGraphicsElement[];
      for (const node of graphics) {
        if (typeof node.getBBox !== "function") continue;
        try {
          const { x, y, width, height } = node.getBBox();
          if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
          if (width === 0 && height === 0) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
        } catch {
          // ignore nodes without a computable bounding box
        }
      }
    } finally {
      imported.remove();
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return svgMarkup;
    }

    const useUnitViewBox = options?.useUnitViewBox ?? false;

    const hasBaseWidth =
      options &&
      typeof options.baseWidth === "number" &&
      Number.isFinite(options.baseWidth);
    const hasBaseHeight =
      options &&
      typeof options.baseHeight === "number" &&
      Number.isFinite(options.baseHeight);

    let left = Math.floor(minX);
    let top = Math.floor(minY);
    let right = Math.ceil(maxX);
    let bottom = Math.ceil(maxY);
    let widthUnits = Math.max(1, right - left);
    let heightUnits = Math.max(1, bottom - top);

    const targetWidth = hasBaseWidth
      ? (options!.baseWidth as number)
      : originalWidth ?? originalViewBoxWidth ?? widthUnits;
    const targetHeight = hasBaseHeight
      ? (options!.baseHeight as number)
      : originalHeight ?? originalViewBoxHeight ?? heightUnits;

    const paddingPx = options?.paddingPx ?? 0;
    if (paddingPx > 0 && targetWidth > 2 * paddingPx && targetHeight > 2 * paddingPx) {
      const widthUnits0 = widthUnits;
      const heightUnits0 = heightUnits;

      const padUnitsX =
        (widthUnits0 * paddingPx) / (targetWidth - 2 * paddingPx);
      const padUnitsY =
        (heightUnits0 * paddingPx) / (targetHeight - 2 * paddingPx);

      left -= padUnitsX;
      right += padUnitsX;
      top -= padUnitsY;
      bottom += padUnitsY;

      widthUnits = Math.max(1, right - left);
      heightUnits = Math.max(1, bottom - top);
    }

    svgEl.setAttribute(
      "viewBox",
      `${left} ${top} ${widthUnits} ${heightUnits}`
    );
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const widthScale = useUnitViewBox
      ? targetWidth / 100
      : targetWidth / Math.max(widthUnits, 1);
    const heightScale = useUnitViewBox
      ? targetHeight / 100
      : targetHeight / Math.max(heightUnits, 1);

    const widthPx = Math.max(1, Math.round(widthUnits * widthScale));
    const heightPx = Math.max(1, Math.round(heightUnits * heightScale));

    svgEl.setAttribute("width", `${widthPx}`);
    svgEl.setAttribute("height", `${heightPx}`);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  } catch {
    return svgMarkup;
  }
}

/* ---------- Search (debounced) ---------- */
const shapeSearchQuery = ref("");
const shapeSearchTerm = ref("");
let _shapeSearchTimer: number | undefined;
watch(shapeSearchQuery, (v) => {
  if (_shapeSearchTimer) window.clearTimeout(_shapeSearchTimer);
  _shapeSearchTimer = window.setTimeout(() => (shapeSearchTerm.value = v), 140);
});

const allShapes = computed<ShapeItem[]>(() =>
  [...SHAPES].sort((a, b) => a.label.localeCompare(b.label))
);
const filteredShapes = computed<ShapeItem[]>(() => {
  const q = shapeSearchTerm.value.trim().toLowerCase();
  return q
    ? allShapes.value.filter(
        (s) => s.label.toLowerCase().includes(q) || s.key.includes(q)
      )
    : allShapes.value;
});

/* ---------- Virtualization ---------- */
const shapeScrollRef = ref<HTMLDivElement | null>(null);
const shapeContainerH = ref(0);
const shapeContainerW = ref(0);
const shapeScrollTop = ref(0);

const COL_MIN = 96; // px incl. padding/gap
const ROW_H = 112; // px approx tile height incl. gap
const BUFFER_ROWS = 3;

let shapeResizeObs: ResizeObserver | null = null;

function measureShapeContainer() {
  const el = shapeScrollRef.value;
  if (!el) return;
  shapeContainerH.value = el.clientHeight;
  shapeContainerW.value = el.clientWidth;
}

onMounted(() => {
  const el = shapeScrollRef.value;
  if (el) {
    el.addEventListener(
      "scroll",
      () => {
        shapeScrollTop.value = el.scrollTop;
      },
      { passive: true }
    );
  }
  shapeResizeObs = new ResizeObserver(measureShapeContainer);
  if (el) shapeResizeObs.observe(el);
  measureShapeContainer();
});
onBeforeUnmount(() => {
  if (shapeResizeObs && shapeScrollRef.value)
    shapeResizeObs.unobserve(shapeScrollRef.value);
  shapeResizeObs = null;
});

const shapeCols = computed(() =>
  Math.max(1, Math.floor((shapeContainerW.value + 8) / COL_MIN))
);
const shapeTotalRows = computed(() =>
  Math.ceil(filteredShapes.value.length / shapeCols.value)
);
const shapeVisibleRowCount = computed(
  () => Math.ceil(shapeContainerH.value / ROW_H) + BUFFER_ROWS * 2
);
const shapeStartRow = computed(() =>
  Math.max(0, Math.floor(shapeScrollTop.value / ROW_H) - BUFFER_ROWS)
);
const shapeEndRow = computed(() =>
  Math.min(
    shapeTotalRows.value,
    shapeStartRow.value + shapeVisibleRowCount.value
  )
);
const shapeStartIdx = computed(() => shapeStartRow.value * shapeCols.value);
const shapeEndIdx = computed(() =>
  Math.min(filteredShapes.value.length, shapeEndRow.value * shapeCols.value)
);

const visibleShapes = computed(() =>
  filteredShapes.value.slice(shapeStartIdx.value, shapeEndIdx.value)
);
const shapeTopSpacer = computed(() => shapeStartRow.value * ROW_H);
const shapeBottomSpacer = computed(() =>
  Math.max(0, (shapeTotalRows.value - shapeEndRow.value) * ROW_H)
);

watch(shapeSearchTerm, () => {
  const el = shapeScrollRef.value;
  if (el) el.scrollTop = 0;
  shapeScrollTop.value = 0;
});

watch(
  () => props.activeMenu,
  async (val) => {
    if (val === "Shapes") {
      await nextTick();
      const el = shapeScrollRef.value;
      if (el) {
        // attach listeners if not attached yet
        el.addEventListener(
          "scroll",
          () => {
            shapeScrollTop.value = el.scrollTop;
          },
          { passive: true }
        );
        if (!shapeResizeObs) {
          shapeResizeObs = new ResizeObserver(measureShapeContainer);
        }
        try {
          shapeResizeObs.observe(el);
        } catch {}
        measureShapeContainer();
      }
    }
  }
);

/* ---------- NEW: detect selected *shape image* (identifier-based) ---------- */
const selectedShapeInfo = computed(() => {
  const so = selectedObject.value as any;
  const info = parseShapeFromAny(so);
  return info.key ? info : null;
});

/* ---------- Selection classification: icon by URL -> else shape -> else regular image ---------- */
function getImgUrl(so: any): string {
  return typeof so?.imgUrl === "string"
    ? so.imgUrl
    : typeof so?.src === "string"
    ? so.src
    : "";
}
function isIconifySvgUrl(url: string): boolean {
  // strict match using the same parser used elsewhere
  return !!parseIconFromUrl(url).full;
}

const selectionKind = computed(() => {
  const so = selectedObject.value as any;
  if (!so || so.type !== "image")
    return { isIcon: false, isShape: false, isImage: false };

  if (so.elementType === "icon") {
    return { isIcon: true, isShape: false, isImage: false };
  }
  if (so.elementType === "shape") {
    return { isIcon: false, isShape: true, isImage: false };
  }

  const url = getImgUrl(so);

  // 1) If the URL matches Iconify's SVG format, treat as ICON
  if (isIconifySvgUrl(url)) {
    return { isIcon: true, isShape: false, isImage: false };
  }

  // 2) Otherwise, if we can parse a shape identifier/meta, treat as SHAPE
  const shape = parseShapeFromAny(so);
  if (shape.key) {
    return { isIcon: false, isShape: true, isImage: false };
  }

  // 3) Otherwise, it's probably a regular IMAGE/bitmap
  return { isIcon: false, isShape: false, isImage: true };
});

// Booleans used by the template
const isIconSelected = computed(() => selectionKind.value.isIcon);
const isShapeImageSelected = computed(() => selectionKind.value.isShape);

// For template v-ifs (works even if only the identifier is present)
const selectedShapeType = computed<ShapeType | undefined>(() => {
  const metaType = selectedObject.value?.shapeMeta?.shapeType as
    | ShapeType
    | undefined;
  if (metaType) return metaType;

  const info = selectedShapeInfo.value;
  if (info?.type) return info.type;

  if (info?.key)
    return SHAPES.find((s) => s.key === info.key)?.type as
      | ShapeType
      | undefined;
  return undefined;
});

/* ---------- Controls state (optional; lets you re-generate the SVG on changes) ---------- */
// Helper to ensure shapeMeta is present on selectedObject (if not, create it)
function ensureShapeMeta(so: any): ShapeMeta | undefined {
  if (!so) return undefined;
  if (so.shapeMeta && typeof so.shapeMeta === "object")
    return so.shapeMeta as ShapeMeta;

  const info = parseShapeFromAny(so);
  if (!info.key) return undefined;

  const key = info.key;
  const item = SHAPES.find((s) => s.key === key);
  const metaSource = info.meta ?? {};

  const outlineOnly = new Set(["line-h", "line-v", "plus", "cross", "check"]);
  const defaultStrokeWidth = outlineOnly.has(key) ? 8 : 2;

  const meta: ShapeMeta = {
    key,
    shapeType:
      (info.type as ShapeType) ||
      (metaSource.shapeType as ShapeType) ||
      item?.type ||
      "rect",
    style:
      (metaSource.style as "filled" | "outline") ||
      (item?.init?.style as any) ||
      "filled",
    fill: (metaSource.fill as string) || "#000000",
    stroke: (metaSource.stroke as string) || "#000000",
    strokeWidth: Number.isFinite(metaSource.strokeWidth as any)
      ? (metaSource.strokeWidth as number)
      : defaultStrokeWidth,
    cornerRadius: Number.isFinite(metaSource.cornerRadius as any)
      ? (metaSource.cornerRadius as number)
      : item?.init?.cornerRadius ?? 12,
    points: Number.isFinite(metaSource.points as any)
      ? (metaSource.points as number)
      : item?.init?.points ?? 5,
    sides: Number.isFinite(metaSource.sides as any)
      ? (metaSource.sides as number)
      : item?.init?.sides ?? (item?.type === "polygon" ? 6 : 0),
    width: 512,
    height: 512,
    previewPath: (metaSource.previewPath as string) || item?.previewPath,
    previewPoints: (metaSource.previewPoints as string) || item?.previewPoints,
  };

  so.shapeMeta = meta;
  so.elementType = "shape";
  so.elementVariant = key;
  const label = SHAPES.find((s) => s.key === key)?.label ?? key;
  so.name = label;

  return meta;
}

// expose reactive wrappers for controls (use ensureShapeMeta)
const selectedShapeStyle = computed({
  get: () => {
    const so = selectedObject.value as any;
    const m = ensureShapeMeta(so);
    return (m?.style as "filled" | "outline") ?? "filled";
  },
  set: (val: "filled" | "outline") => {
    const so = selectedObject.value as any;
    const m = ensureShapeMeta(so);
    if (!m) return;
    m.style = val;
    applyToSelectedShapeImage();
  },
});

const shapeFill = computed({
  get: () => {
    const m = ensureShapeMeta(selectedObject.value as any);
    return m?.fill ?? "#000000";
  },
  set: (val: string) => {
    const m = ensureShapeMeta(selectedObject.value as any);
    if (!m) return;
    m.fill = val;
    applyToSelectedShapeImage();
  },
});

const shapeStroke = computed({
  get: () => {
    const m = ensureShapeMeta(selectedObject.value as any);
    return m?.stroke ?? "#000000";
  },
  set: (val: string) => {
    const m = ensureShapeMeta(selectedObject.value as any);
    if (!m) return;
    m.stroke = val;
    applyToSelectedShapeImage();
  },
});

const shapeStrokeWidth = computed({
  get: () => {
    const m = ensureShapeMeta(selectedObject.value as any);
    return m?.strokeWidth ?? 2;
  },
  set: (val: number) => {
    const m = ensureShapeMeta(selectedObject.value as any);
    if (!m) return;
    m.strokeWidth = val;
    applyToSelectedShapeImage();
  },
});

const shapeCornerRadius = computed({
  get: () => {
    const m = ensureShapeMeta(selectedObject.value as any);
    return m?.cornerRadius ?? 12;
  },
  set: (val: number) => {
    const m = ensureShapeMeta(selectedObject.value as any);
    if (!m) return;
    m.cornerRadius = val;
    applyToSelectedShapeImage();
  },
});

const shapePoints = ref<number>(5);
const shapeSides = ref<number>(6);

const syncingShapeFromSelection = ref(false);

function syncFromSelectedShapeImage() {
  const so = selectedObject.value as any;
  syncingShapeFromSelection.value = true;
  if (isShapeImageSelected.value && so) {
    const meta = ensureShapeMeta(so)!;
    selectedShapeStyle.value = (meta.style as any) ?? "filled";
    shapeFill.value = (meta.fill as any) ?? "#000000";
    shapeStroke.value = (meta.stroke as any) ?? "#000000";
    shapeStrokeWidth.value = Number.isFinite(meta.strokeWidth as any)
      ? (meta.strokeWidth as number)
      : 2;
    shapeCornerRadius.value = Number.isFinite(meta.cornerRadius as any)
      ? (meta.cornerRadius as number)
      : 12;
    shapePoints.value = Number.isFinite(meta.points as any)
      ? (meta.points as number)
      : 5;
    shapeSides.value = Number.isFinite(meta.sides as any)
      ? (meta.sides as number)
      : meta.shapeType === "polygon"
      ? 6
      : 0;
  }
  queueMicrotask(() => (syncingShapeFromSelection.value = false));
}
watch(selectedObject, syncFromSelectedShapeImage, { immediate: true });

function applyToSelectedShapeImage() {
  if (syncingShapeFromSelection.value) return;
  const so = selectedObject.value as any;
  if (!isShapeImageSelected.value || !so) return;

  // Preserve current geometry so the shape stays in the exact same
  // spot/size on the canvas even if the underlying SVG crop/padding changes.
  const prevX = so.x;
  const prevY = so.y;
  const prevW = so.w;
  const prevH = so.h;
  const prevRotation = so.rotation;

  const baseKey =
    typeof so.elementVariant === "string" && so.elementVariant.length
      ? so.elementVariant
      : typeof so.name === "string" && so.name.startsWith("shape:")
      ? so.name.slice(6)
      : so.shapeMeta?.key || "rect";
  const inferredType = SHAPES.find((s) => s.key === baseKey)?.type as
    | ShapeType
    | undefined;
  const meta: ShapeMeta = {
    key: baseKey,
    shapeType: so.shapeMeta?.shapeType || inferredType || "rect",
    style: selectedShapeStyle.value,
    fill: shapeFill.value,
    stroke: shapeStroke.value,
    strokeWidth: shapeStrokeWidth.value,
    cornerRadius: shapeCornerRadius.value,
    points: shapePoints.value,
    sides: shapeSides.value,
    width: 512,
    height: 512,
    previewPath: so.shapeMeta?.previewPath,
    previewPoints: so.shapeMeta?.previewPoints,
  };

  const svg = svgFromShapeMeta(meta);
  const url = svgDataUrlWithId(svg, meta.key);

  so.shapeMeta = meta;
  so.elementType = "shape";
  so.elementVariant = meta.key;
  const friendlyLabel =
    SHAPES.find((s) => s.key === meta.key)?.label ?? meta.key;
  so.name = friendlyLabel;
  so.imgUrl = url;
  so.isVector = true;

  const handleLoad = () => {
    if (typeof prevX === "number") so.x = prevX;
    if (typeof prevY === "number") so.y = prevY;
    if (typeof prevW === "number") so.w = prevW;
    if (typeof prevH === "number") so.h = prevH;
    if (typeof prevRotation === "number") so.rotation = prevRotation;
    props.draw();
  };

  if (so.img && typeof so.img === "object") {
    so.img.onload = handleLoad;
    so.img.crossOrigin = "anonymous";
    so.img.src = url;
  } else {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = handleLoad;
    img.src = url;
    so.img = img;
  }
}
watch(
  [
    selectedShapeStyle,
    shapeFill,
    shapeStroke,
    shapeStrokeWidth,
    shapeCornerRadius,
    shapePoints,
    shapeSides,
  ],
  applyToSelectedShapeImage
);

/* ---------- CLICK: now creates an IMAGE (SVG data URL) ---------- */
function chooseShape(s: ShapeItem) {
  const OUTLINE_ONLY = new Set(["line-h", "line-v", "plus", "cross", "check"]);
  const FILL_ALWAYS = new Set(["cloud", "chat-bubble"]);

  let style: "filled" | "outline";
  let strokeWidth = 2;

  if (OUTLINE_ONLY.has(s.key)) {
    style = "outline";
    strokeWidth = 8; // visible at small size
  } else if (FILL_ALWAYS.has(s.key)) {
    style = "filled";
  } else {
    style = (s.init?.style ?? "filled") as any;
  }

  const meta: ShapeMeta = {
    key: s.key,
    shapeType: s.type,
    style,
    fill: "#000000",
    stroke: "#000000",
    strokeWidth,
    cornerRadius: s.init?.cornerRadius ?? 12,
    points: s.init?.points ?? 5,
    sides: s.init?.sides ?? (s.type === "polygon" ? 6 : 0),
    width: 512,
    height: 512,
    previewPath: s.previewPath,
    previewPoints: s.previewPoints,
  };

  const svg = svgFromShapeMeta(meta);
  const url = svgDataUrlWithId(svg, meta.key);

  emit("uploadObject", "image", {
    imgUrl: url,
    isVector: true,
    elementType: "shape",
    elementVariant: s.key,
    name: s.label,
    shapeMeta: meta,
  });
}

/* =========================================================
     IMAGE UPLOAD (files, drag/drop, validation)
     =======================================================*/
const fileInput = ref<HTMLInputElement | null>(null);
const allowedTypes = [
  "image/png",
  "image/ai",
  "image/eps",
  "image/pdf",
  "image/heic",
  "image/avif",
  "image/tiff",
  "image/svg+xml",
];
const maxFileSizeMB = 20;

const allowedTypesDisplay = computed(() =>
  allowedTypes.map((t) => t.split("/")[1].toUpperCase()).join(", ")
);

function openFileDialog() {
  fileInput.value?.click();
}

function validateFile(file: File): boolean {
  const isValidType = allowedTypes.includes(file.type);
  const isValidSize = file.size <= maxFileSizeMB * 1024 * 1024;
  return isValidType && isValidSize;
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files?.length && validateFile(files[0])) {
    const file = files[0];
    const isSvg = file.type === "image/svg+xml";
    const variant = isSvg ? "svg" : "bitmap";
    const displayName = file.name
      ? file.name.replace(/\.[^/.]+$/, "")
      : "Image";
    const url = URL.createObjectURL(file);
    addRecentUpload({ url, name: displayName, isVector: isSvg });
    emit("uploadObject", "image", {
      imgUrl: url,
      elementType: "image",
      elementVariant: variant,
      name: displayName,
      isVector: isSvg,
    });
  } else {
    alert(
      `File must be one of: ${allowedTypes.join(
        ", "
      )} and under ${maxFileSizeMB}MB`
    );
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}
function handleDragLeave() {
  isDragging.value = false;
}
function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files?.length && validateFile(files[0])) {
    const file = files[0];
    const isSvg = file.type === "image/svg+xml";
    const variant = isSvg ? "svg" : "bitmap";
    const displayName = file.name
      ? file.name.replace(/\.[^/.]+$/, "")
      : "Image";
    const url = URL.createObjectURL(file);
    addRecentUpload({ url, name: displayName, isVector: isSvg });
    emit("uploadObject", "image", {
      imgUrl: url,
      elementType: "image",
      elementVariant: variant,
      name: displayName,
      isVector: isSvg,
    });
  } else {
    alert(
      `File must be one of: ${allowedTypes.join(
        ", "
      )} and under ${maxFileSizeMB}MB`
    );
  }
}

/* =========================================================
     CLOTHING CREATE FLOW (brand, sizes, genders)
     =======================================================*/
const isCreating = ref(false);

// brand suggestions
const selectedBrand = ref("");
const showBrandSuggestions = ref(true);
// live categories & genders (from DB)
const categories = ref<any[]>([]);
const gendersList = ref<any[]>([]);

onMounted(async () => {
  loadRecentUploadsFromSession();
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("*")
    .order("code", { ascending: true });
  const { data: gendersData } = await supabase
    .from("genders")
    .select("*")
    .order("code", { ascending: true });

  if (categoriesData) categories.value = categoriesData as any[];
  if (gendersData) gendersList.value = gendersData as any[];
});

// new clothing form state
const showCreateForm = ref(false);
const newClothingName = ref("");

// autofill prompt
const autofillPrompt = ref("");
const ssactivewearBrand = ref("");
const ssactivewearStyle = ref("");

/* =========================================================
     SSACTIVEWEAR FETCH (colors / brand / style)
     =======================================================*/
const productColors = computed(() => PRODUCT_COLORS.value);
const productColorIndex = computed(() => selectedProductColorIndex.value);
const activeProductColor = computed(
  () => productColors.value[productColorIndex.value] ?? null
);

const sizeAvailabilityNotice = ref("");
let sizeNoticeTimer: ReturnType<typeof setTimeout> | undefined;

const availableSizes = computed(() =>
  extractColorSizes(activeProductColor.value)
);

let sizeSliderIndexCache = 0;

const sizeSliderIndex = computed({
  get: () => {
    const sizes = availableSizes.value;
    if (!sizes.length) {
      sizeSliderIndexCache = 0;
      return 0;
    }
    const current = selectedProductSize.value;
    if (!current) {
      sizeSliderIndexCache = Math.min(
        sizeSliderIndexCache,
        Math.max(0, sizes.length - 1)
      );
      return sizeSliderIndexCache;
    }
    const currentNorm = normalizeSizeToken(current);
    const idx = sizes.findIndex(
      (entry) => normalizeSizeToken(entry) === currentNorm
    );
    if (idx >= 0) {
      sizeSliderIndexCache = idx;
      return idx;
    }
    sizeSliderIndexCache = Math.min(
      sizeSliderIndexCache,
      Math.max(0, sizes.length - 1)
    );
    return sizeSliderIndexCache;
  },
  set: (value: number) => {
    const sizes = availableSizes.value;
    if (!sizes.length) {
      setSelectedProductSize(null);
      return;
    }
    const clamped = Math.max(0, Math.min(sizes.length - 1, Math.round(value)));
    sizeSliderIndexCache = clamped;
    setSelectedProductSize(sizes[clamped]);
  },
});

const activeSizeIndex = computed(() => {
  const sizes = availableSizes.value;
  if (!sizes.length) return -1;
  const current = selectedProductSize.value;
  if (!current) return -1;
  const currentNorm = normalizeSizeToken(current);
  return sizes.findIndex((entry) => normalizeSizeToken(entry) === currentNorm);
});

function handleProductColorClick(index: number) {
  let sizeUnavailable = false;
  setSelectedProductColorIndex(index, {
    onSizeUnavailable: ({ requestedSize, colorName }) => {
      sizeUnavailable = true;
      showSizeNotice(requestedSize, colorName);
    },
  });
  if (!sizeUnavailable) {
    clearSizeNotice();
  }
}

function resetSizeNoticeTimer() {
  if (sizeNoticeTimer !== undefined) {
    clearTimeout(sizeNoticeTimer);
    sizeNoticeTimer = undefined;
  }
}

function showSizeNotice(size: string, colorName: string) {
  resetSizeNoticeTimer();
  sizeAvailabilityNotice.value = `${size} unavailable in ${colorName}`;
  sizeNoticeTimer = setTimeout(() => {
    sizeAvailabilityNotice.value = "";
    sizeNoticeTimer = undefined;
  }, 4000);
}

function clearSizeNotice() {
  sizeAvailabilityNotice.value = "";
  resetSizeNoticeTimer();
}

watch(selectedProductSize, (size, prev) => {
  if (!sizeAvailabilityNotice.value) return;
  if (size && size !== prev) {
    clearSizeNotice();
  }
});

onBeforeUnmount(() => {
  resetSizeNoticeTimer();
});

function swatchStyle(color: any) {
  const style: Record<string, string> = {
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  if (color?.hex) {
    style.background = color.hex;
    style.backgroundImage = "none";
  } else if (color?.frontUrl) {
    style.backgroundImage = `url(${color.frontUrl})`;
  } else {
    style.background = "#e5e7eb";
  }
  return style;
}

watch(
  availableSizes,
  (sizes) => {
    if (!sizes.length) {
      if (selectedProductSize.value !== null) {
        setSelectedProductSize(null);
      }
      return;
    }
    const current = selectedProductSize.value;
    if (!current) {
      setSelectedProductSize(sizes[0]);
      return;
    }
    const match = findMatchingSize(current, sizes);
    if (match && match !== current) {
      setSelectedProductSize(match);
      return;
    }
  },
  { immediate: true }
);

function colorSizesLabel(color: any) {
  const sizes = extractColorSizes(color);
  if (!sizes.length) return "—";
  return `${sizes.join(" · ")}`;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function colorHasPrice(color: any) {
  return typeof color?.price === "number" && Number.isFinite(color.price);
}

function colorPriceLabel(color: any) {
  const amount = typeof color?.price === "number" ? color.price : Number.NaN;
  if (!Number.isFinite(amount)) return "";
  const currency =
    typeof color?.currency === "string" && color.currency.trim()
      ? color.currency.trim().toUpperCase()
      : "USD";
  let formatted: string;
  try {
    const formatter =
      currencyFormatters.get(currency) ??
      new Intl.NumberFormat("en-US", { style: "currency", currency });
    currencyFormatters.set(currency, formatter);
    formatted = formatter.format(amount);
  } catch {
    formatted = `${currency} ${amount.toFixed(2)}`;
  }
  const minimum =
    typeof color?.quantityMin === "number" &&
    Number.isFinite(color.quantityMin) &&
    color.quantityMin > 1
      ? ` · Min ${color.quantityMin}`
      : "";
  return `${formatted}${minimum}`;
}

/* =========================================================
     MENU CONTROLS
     =======================================================*/
function closeMenu() {
  emit("closeMenu");
  showCreateForm.value = false;
  isCreating.value = false;
}

/* =========================================================
     UTILS
     =======================================================*/
</script>

<style scoped lang="scss">
* {
  transition: all 0.25s ease;
}
.slide-menu {
  position: absolute;
  top: 1;
  left: 13.5rem;
  margin-left: auto;

  width: 30rem;
  max-height: 35rem;
  background-color: rgb(250, 250, 250);
  color: white;
  z-index: 10;
  border-bottom-right-radius: 20px;
  border-top-right-radius: 20px;
  display: flex;
  flex-direction: column;
}

.slide-menu-header {
  font-family: "Anek Latin";
  align-items: center;
  display: flex;
  justify-content: space-between;
  background: rgb(75, 85, 93);
  height: 1rem;
  font-size: 1rem;
  line-height: 1rem;
  border-top-right-radius: 20px;
}

.menu-title {
  flex-grow: 0.83;
  text-align: center;
}

.close-btn,
.back-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  line-height: 1rem;
  scale: 0.75;
}

.slide-menu-content {
  margin: 1rem;
  color: #232323;
  font-family: "Anek Latin";
  margin-top: 1rem;
  max-height: 35rem;
  overflow-y: auto;
}

.upload-img {
  height: 5rem;
  margin: 0rem;
  margin-top: 3rem;
  object-fit: contain;
}

.upload-container {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='20' ry='20' stroke='%236B7078FF' stroke-width='2' stroke-dasharray='5%2c10' stroke-dashoffset='15' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 20px;
  height: 15rem;
  margin-left: 1rem;
  margin-right: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  padding-bottom: 3rem;
  font-weight: 300;
  cursor: pointer;

  h3 {
    margin: 0rem;
    margin-bottom: -0.5rem;
    font-size: 1rem;
    font-weight: 600;
  }

  span {
    margin: 0rem;
    font-size: 0.6rem;
  }

  p {
    margin: 1rem;
    font-size: 0.75rem;
  }
}

.upload-img-container {
  margin-top: -1rem;
  padding-bottom: 0.5rem;

  .underlined {
    border-bottom: 2px solid #94c940;
    height: 21px;
    color: inherit;
    text-decoration: none;
    display: inline-block;
    vertical-align: top;
  }

  p {
    margin: 0;
    font-size: large;
    font-weight: 500;
  }
}

.upload-details {
  margin: auto;
  width: 80%;
  text-align: left;
  font-size: small;
  margin-top: 2rem;

  h4 {
    margin-bottom: 0;
  }

  p {
    margin-top: 0;
  }
}

.recent-uploads {
  margin: 1.5rem auto 0;
  width: 80%;
  font-size: 0.8rem;
}

.recent-uploads h4 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #111827;
}

.recent-uploads__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.recent-uploads__thumb {
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 0.25rem 0.35rem 0.35rem;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.recent-uploads__thumb img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 0.35rem;
}

.recent-uploads__label {
  max-width: 4.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #374151;
}

.upload-btn {
  background-color: #94c940;
  border: none;
  padding: 0.5rem 1rem;
  color: #222;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 1rem;
}

.custom-block {
  position: absolute;
  left: 50%;
  background: #232323;
  border: 1px solid #3aff68;
  box-shadow: greenyellow 0px 1px 5px;
  width: fit-content;
  height: fit-content;
  border-radius: 6px;
  color: #fff;
  z-index: 50;
  text-transform: uppercase;
  font-family: "Gujarati Sangam MN";
  font-weight: 500;
  font-size: 1.5rem;
  padding: 1rem;
}

.autofill-btn {
  margin-left: 1rem;
  margin-right: 1rem;
  font-size: 1rem;
  background-color: #191919;
  text-transform: uppercase;
}

.yes {
  border: 2px solid lawngreen;
  box-shadow: lawngreen 0px 1px 5px;
}

.no {
  border: 2px solid red;
  box-shadow: red 0px 1px 5px;
}

.colors-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.color-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 1px solid #fff;
  cursor: pointer;
}

.product-colors-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0;
}

.color-status {
  font-size: 0.9rem;
  color: #475569;
}

.product-colors-grid {
  display: flex;
  flex-direction: column;

  gap: 0.5rem;
  overflow: auto;
  max-height: 35vh;
}

.product-color-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.5rem 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.product-color-button.is-selected {
  border-color: #a4cc7e;
  background: #f8ffe3;
  box-shadow: 0 0 0 2px rgba(189, 235, 37, 0.2);
}

.product-color-swatch {
  width: 100%;
  height: 1.5rem;
  border-radius: 7.5px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  background-size: cover;
  background-position: center;
}

.product-color-meta {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0.1rem;
}

.product-color-name {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.product-color-details {
  display: flex;
  justify-content: space-between;
}

.product-color-price {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.product-color-sizes {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.product-size {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: linear-gradient(
    135deg,
    rgba(248, 250, 252, 0.9),
    rgba(226, 232, 240, 0.75)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.product-size--disabled {
  opacity: 0.7;
}

.product-size__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-size__label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
}

.product-size__selection {
  font-size: 0.78rem;
  font-weight: 600;
  color: #1f2937;
}

.product-size__notice {
  font-size: 0.75rem;
  font-weight: 600;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid rgba(217, 119, 6, 0.35);
  border-radius: 0.5rem;
  padding: 0.35rem 0.6rem;
}

.product-size__slider {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.product-size__weight-slider {
  width: 100%;
}

.product-size__scale {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.product-size__scale-label {
  flex: 1;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 500;
  color: #64748b;
  transition: color 0.2s ease, transform 0.2s ease;
}

.product-size__scale-label.is-active {
  color: #1f2937;
  font-weight: 700;
  transform: translateY(-2px);
}

.product-size__empty {
  font-size: 0.82rem;
  color: #64748b;
}

.guide-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #232323;
}

.guide-panel__hero h3 {
  margin: 0.25rem 0 0.35rem;
  font-size: 1.5rem;
  letter-spacing: 0.03em;
  text-align: center;
  color: #191919;
}

.guide-panel__hero p {
  margin: 0;
  font-size: 0.9rem;
  color: #4b5563;
  text-align: center;
}

.guide-panel__eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #94c940;
  text-align: center;
}

.guide-panel__steps {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.guide-step {
  display: flex;
  gap: 0.7rem;
  padding: 0.65rem;
  border-radius: 0.75rem;
  background: #f9fafb;
  border: 1px solid #d0d5dd;
}

.guide-step h4 {
  margin: 0;
  font-size: 1rem;
  color: #111827;
}

.guide-step p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: #4b5563;
}

.guide-step__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: #94c940;
  padding-right: 0.1rem;
}

.guide-panel__tips {
  background: #f3f4f6;
  border-radius: 0.7rem;
  padding: 0.8rem;
  border: 1px solid #d0d5dd;
}

.guide-panel__tips h4 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
  color: #111827;
}

.guide-panel__tips ul {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.guide-panel__tips li {
  font-size: 0.85rem;
  color: #4b5563;
}

#create-color {
  font-size: 0.25rem;
}

svg {
  object-fit: contain;
  height: 1rem;
}

.iconLib {
  border-radius: 7px;
  padding: 0.5rem;
  background: #fff;

  overflow-y: scroll;
}

.icon-status {
  color: #4d555d;
  font-size: 0.9rem;
  padding: 0.5rem;
}

.icon-status.error {
  color: #b00020;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.icon-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid #e3e6ea;
  border-radius: 8px;
  background: #fafbfc;
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease;
}

.icon-tile:hover {
  transform: translateY(-1px);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
  background: #fff;
}

.icon-tile:active {
  transform: translateY(0);
  box-shadow: none;
}

.icon-tile img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  display: block;
}

.icon-name {
  font-size: 0.72rem;
  color: #646f79;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 100%;
  white-space: nowrap;
}

.icon-hint {
  margin-top: 0.5rem;
  font-size: 0.74rem;
  color: #7d858c;
  text-align: right;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.75rem;

  button {
    color: #191919;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #ccc;
    background: #f8f9fa;
    cursor: pointer;
    font-size: 0.85rem;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
}

.controls {
  border-radius: 0.75rem;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;

  .controls__title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #111827;
  }

  .shape-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "style colors"
      "stroke stroke"
      "detail detail";
    gap: 0.85rem 1rem;
  }

  .shape-grid__style {
    grid-area: style;
    border-radius: 1rem;
    box-sizing: border-box;
  }

  .shape-grid__colors {
    grid-area: colors;
    border-radius: 1rem;
    box-sizing: border-box;
  }

  .shape-grid__stroke {
    grid-area: stroke;
    border-radius: 1rem;
  }

  .shape-grid__detail {
    grid-area: detail;
  }

  .controls__field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .controls__label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #2f3640;
    letter-spacing: 0.05em;
  }

  .shape-style-toggle {
    position: relative;
    display: flex;
    padding: 3px;
    border-radius: 12px;
    background: rgba(17, 24, 39, 0.06);
    gap: 4px;
    margin: 0 auto;
    border: 1px solid rgba(17, 24, 39, 0.06);
    width: 5;
    /* default: two segments, first active */
    --segments: 1;
    --segment-offset: 7.5px;
    --active-index: 0;
  }

  /* If a third button is present, automatically switch to 3 segments */
  .shape-style-toggle:has(.shape-style-toggle__btn:nth-child(2)) {
    --segments: 2;
    --segment-offset: 5px;
  }

  /* If a third button is present, automatically switch to 3 segments */
  .shape-style-toggle:has(.shape-style-toggle__btn:nth-child(3)) {
    --segments: 3;
    --segment-offset: 4px;
  }

  .shape-style-toggle::before {
    content: "";
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    /* one segment wide, minus horizontal padding */
    width: calc(100% / var(--segments) - var(--segment-offset));
    border-radius: 9px;
    background: rgb(255, 255, 255);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
    border: 1px solid rgba(15, 23, 42, 0.08);
    /* slide one full knob-width per index */
    transform: translateX(calc(var(--active-index) * 100%));
    transition: transform 0.18s ease-out;
  }

  /* Backwards-compatible alias: "outline" is the second segment */
  .shape-style-toggle--outline {
    --active-index: 1;
  }

  /* Optional explicit index helpers for 3+ buttons */
  .shape-style-toggle--index-0 {
    --active-index: 0;
  }
  .shape-style-toggle--index-1 {
    --active-index: 1;
  }
  .shape-style-toggle--index-2 {
    --active-index: 2;
  }

  .shape-style-toggle__btn {
    position: relative;
    z-index: 1;
    left: 0;
    justify-content: center;
    text-align: center;
    margin: 0 auto;
    border: none;
    background: transparent;
    width: 5rem;
    padding: 0.35rem 0.85rem;
    font-size: 0.8rem;
    border-radius: 10px;
    cursor: pointer;
    color: #1f2937;
    font-weight: 600;
    transition: all 0.12s ease;
    text-transform: uppercase;
  }

  .shape-style-toggle__btn--active {
    color: #0f172a;
    border-radius: 1rem;
  }

  .shape-color-pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .shape-color-input {
    width: 100%;
    height: 2rem;
    padding: 0rem;
    border-radius: 10px;

    cursor: pointer;
    box-sizing: content-box;
  }

  input[type="color"] {
    -moz-appearance: none;
    appearance: none;

    padding: 3px;
    margin: auto;
    width: 32px;
    height: 26.2px;
    background: rgba(17, 24, 39, 0.06);
    border: 1px solid rgba(15, 23, 42, 0.08);
  }

  input[type="color"]::-moz-color-swatch-wrapper {
    padding: 0;
  }

  input[type="color"]::-moz-color-swatch {
    border: none;
    border-radius: 7.5px;
  }

  .shape-slider-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .shape-slider-row input[type="range"] {
    flex: 1;
  }

  .shape-slider-value {
    min-width: 2.5rem;
    text-align: right;
    font-size: 0.78rem;
    color: #4b5563;
  }
}

.search-bar {
  position: relative;
  width: 100%;
  max-width: 100%;
}

.search-bar input {
  width: 100%;
  padding: 0.4rem 2rem 0.4rem 0.8rem;
  background-color: white;
  border: 1px solid #a0a6ac;
  border-radius: 7px;
  font-size: 0.9rem;
  font-family: "Anek Latin";
  color: #4d555d;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #7d858c;
    box-shadow: 0 0 0 2px rgba(125, 133, 140, 0.2);
  }
}

.search-icon {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  color: #6d757d;
  pointer-events: none;
}

.current-swatch-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid #a0a6ac;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.current-swatch-btn .swatch-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-block;
}

.current-swatch-btn .caret {
  opacity: 0.6;
  color: #191919;
}

.swatch-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background: #fff;
  border-left: 1px solid #e3e6ea;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
  z-index: 1200;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid #eef0f2;
}

.drawer-close {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
  line-height: 1;
}

.drawer-body {
  padding: 0.75rem 0.9rem;
  overflow-y: auto;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
}

.swatch-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid #e3e6ea;
  border-radius: 8px;
  background: #fafbfc;
  cursor: pointer;
  color: #232323;

  height: 50px;
}

.swatch-item .dot {
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
}

.swatch-item .name {
  margin: 0 auto;
  border-radius: 50%;
  color: #232323;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.12);
  z-index: 1199;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(16px);
  opacity: 0;
}

.div1 {
  justify-self: center;
  grid-row-start: 1;
  grid-column: span 2 / span 1;
}

.div3 {
  grid-row-start: 2;

  span {
    align-content: center;
  }
}

.div4 {
  grid-column: span 2 / span 2;
  grid-row-start: 3;
}

.buttons {
  border: 1px solid #a0a6ac;
  border-radius: 10px;

  width: fit-content;

  button {
    background-color: transparent;
    color: #232323;
    box-sizing: border-box;
    border-radius: 0px;
    padding: 0.5rem;
  }

  button:first-child {
    border-top-left-radius: inherit;
    border-bottom-left-radius: inherit;
  }

  button:not(:last-child) {
    border-right: 1px solid #a0a6ac;
  }

  button:last-child {
    border-top-right-radius: inherit;
    border-bottom-right-radius: inherit;
  }
}
</style>
// Helper to generate a shape preview image using the new shape generator
pipeline
