<template>
  <div>
    <div v-if="activeMenu" class="slide-menu">
      <div class="slide-menu-header">
        <button v-on:click="activeMenu === 'Text' ? fontPageRef?.backPage?.() : null" class="back-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"
            class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span class="menu-title">{{ headerTitle }}</span>
        <button @click="closeMenu" class="close-btn">
          <CloseIcon />
        </button>
      </div>

      <div class="slide-menu-content">
        <!-- CLOTHING: only “Create New” + Create Form (no selection UI) -->
        <div v-if="activeMenu === 'Clothing'">
          <div v-if="!showCreateForm">
            <button class="style-btn" @click="startCreating" style="display:flex;align-items:center;gap:0.4rem;">
              <PlusIcon /> Create New Clothing
            </button>
          </div>

          <div v-if="showCreateForm" class="create-form">
            <button @click="cancelCreating" class="back-btn" style="align-self: flex-start; margin-bottom: 0.5rem;">←
              Back</button>

            <input :class="['style-text']" v-model="newClothingName" placeholder="Name" />

            <input type="text" v-model="selectedBrand" placeholder="Brand" class="style-text"
              @focus="showBrandSuggestions = true" @click="showBrandSuggestions = true" />
            <div v-if="filteredBrands.length" class="brand-suggestions">
              <div v-for="brand in filteredBrands" :key="brand" class="brand-suggestion-item"
                @click="selectBrand(brand)">
                <img :src="getBrandLogo(brand)" alt="" class="brand-logo-suggestion" />
                <span>{{ brand }}</span>
              </div>
            </div>

            <StyleOptions label="Gender" :options="gendersList" :model-value="newClothingGenders" :valueKey="'code'"
              :display-key="'label'" />
            <StyleOptions label="Style" :options="categories" :model-value="newClothingCategory" :valueKey="'category'"
              :display-key="'name'" />
            <StyleOptions label="Size" :options="allSizes" :model-value="newClothingSizes" multiple />

            <span id="colors-span">Colors
              <button id="create-color">
                <PlusIcon />
              </button>
            </span>


            <button @click="saveNewClothing">Upload to Database</button>
          </div>
        </div>

        <!-- UPLOAD -->
        <div v-else-if="activeMenu === 'Upload'">
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFileChange" />
          <div class="upload-container" @click="openFileDialog" @dragover="handleDragOver" @dragleave="handleDragLeave"
            @drop="handleDrop" :class="{ 'drag-hover': isDragging }">
            <h3>High resolution artwork prints the best!</h3>
            <span>Lower than 300ppi artwork may result in a blurry print with pixelated edges.</span>
            <div class="upload-img-container">
              <img :src="uploadDark" class="upload-img" />
              <p>Drag and Drop or
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
            <p>If your file type is unsupported, or you're facing other problems trying to upload your design shoot us
              an email at <a style="color: #94C940"> cs@seeourdesigns.com.</a></p>
            <p>Our team will review your file and follow up with you before processing your order!</p>
          </div>
        </div>

        <!-- PRODUCT COLORS -->
        <div v-else-if="activeMenu === 'Colors'" class="product-colors-tab">
          <div v-if="!productColors.length" class="color-status">No product colors loaded yet.</div>
          <div v-else class="product-colors-grid">
            <button v-for="(color, index) in productColors" :key="color.id || color.name || index"
              class="product-color-button" :class="{ 'is-selected': index === productColorIndex }"
              @click="handleProductColorClick(index)">
              <span class="product-color-swatch" :style="swatchStyle(color)"></span>
              <span class="product-color-name">{{ color.name || `Color ${index + 1}` }}</span>
            </button>
          </div>
        </div>

        <!-- TEXT -->
        <template v-else-if="activeMenu === 'Text'">
          <FontPage ref="fontPageRef" :selectedObject="selectedObject" :draw="draw"
            @uploadText="(payload: any) => emit('uploadObject', 'text', payload)" @center-text="$emit('center-text')"
            @duplicate-text="$emit('duplicate-text')" @bring-forward="$emit('bring-forward')"
            @send-back="$emit('send-back')" />
        </template>

        <!-- ICONS -->
        <div v-else-if="activeMenu === 'Icons'" id="iconMenu">




          <div class="iconLib" :style="{ height: isIconSelected ? '25rem' : '30rem' }">
            <div class="search-bar">
              <input type="text" placeholder="Search Icons (e.g., home, star, person)" v-model="iconSearchQuery" />
              <span class="search-icon">🔍</span>
            </div>
            <div v-if="iconLoading" class="icon-status">Loading icons…</div>
            <div v-else-if="iconError" class="icon-status error">⚠️ {{ iconError }}</div>
            <div v-else>
              <div v-if="filteredGroups.length === 0" class="icon-status">No icons found.</div>

              <div class="icon-grid">
                <button v-for="g in pagedGroups" :key="g.base" class="icon-tile" @click="chooseIcon(g)"
                  :title="`${g.base} (${g.variants.join(', ')})`">

                  <div style="position: relative; display: inline-block;">
                    <img :src="iconUrl(pickEntryForPreview(g), 48)" :alt="g.base" />

                  </div>

                  <span class="icon-name">{{ g.base }}</span>
                </button>
              </div>

              <div v-if="filteredGroups.length > 0" class="icon-hint">
                Page {{ page }} · Showing {{ pagedGroups.length }} of {{ filteredGroups.length }} groups
              </div>

              <div class="pagination-controls">
                <button @click="prevPage" :disabled="page === 1">Prev</button>
                <button @click="nextPage" :disabled="page * pageSize >= filteredGroups.length">Next</button>
              </div>
            </div>
          </div>


          <div v-if="isIconSelected" class="controls">
            <div v-if="isIconSelected" class="variant-row" style="margin-top: .5rem;">
              <div class="component" id="variants">
                <span>Variant:</span>
                <div class="buttons">
                  <button v-for="variant in selectedIconVariants" :key="variant" class="button"
                    :style="{ backgroundColor: currentVariant === variant ? '#e3e6ea' : 'transparent', fontWeight: currentVariant === variant ? 600 : 'normal' }"
                    @click="currentVariant = variant">
                    {{ prettyVariant(variant) }}
                  </button>
                </div>
              </div>
              <div class="component" id="color">
                <span>Color:</span>
                <!-- inside .component#color, above .swatches -->
                <button class="current-swatch-btn" @click="openSwatchPanel">
                  <span class="swatch-dot" :style="{
                    background: !textColor
                      ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                      : textColor,
                    border: !textColor || textColor === '#ffffff' ? '1px solid #000' : 'none'
                  }"></span>
                  <span class="swatch-label" :style="{
                    opacity: .6,
                    color: '#191919'
                  }">{{ currentSwatchName }}</span>
                  <span class="caret" :style="{ color: '#191919' }">▸</span>
                </button>
                <!-- Side swatch drawer -->
                <transition name="slide-left">
                  <aside v-if="showSwatchPanel" ref="swatchDrawerRef" class="swatch-drawer" role="dialog"
                    aria-label="Choose a color">
                    <div class="drawer-header">
                      <strong>All Colors</strong>
                      <button class="drawer-close" @click="closeSwatchPanel">×</button>
                    </div>

                    <div class="drawer-body">
                      <div class="swatch-grid">
                        <button v-for="c in COLOR_OPTIONS" :key="c.name" class="swatch-item" @click="applyAndClose(c)">
                          <span class="dot" :style="{
                            background: c.name === 'None'
                              ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                              : c.color,
                            border: c.name === 'White' ? '1px solid #000' : 'none'
                          }"></span>
                          <span class="name">{{ c.name }}</span>
                        </button>
                      </div>
                    </div>
                  </aside>
                </transition>
                <div v-if="showSwatchPanel" class="drawer-backdrop" @click="closeSwatchPanel"></div>

              </div>
            </div>
          </div>
        </div>
        <!-- SHAPES TAB -->
        <div v-else-if="activeMenu === 'Shapes'" id="shapesMenu">
          <div class="iconLib" :style="{ height: isShapeImageSelected ? '20rem' : '30rem' }" ref="shapeScrollRef">
            <div class="search-bar">
              <input type="text" placeholder="Search Shapes (e.g., circle, star, arrow)" v-model="shapeSearchQuery" />
              <span class="search-icon">🔍</span>
            </div>

            <div v-if="filteredShapes.length === 0" class="icon-status">No shapes found.</div>

            <div class="virtual-wrap">
              <!-- top spacer to keep scroll height correct -->
              <div :style="{ height: shapeTopSpacer + 'px' }"></div>

              <!-- only render the visible window -->
              <div class="icon-grid">
                <button v-for="s in visibleShapes" :key="s.key" class="icon-tile" @click="chooseShape(s)"
                  :title="s.label">
                  <div style="position: relative; display: inline-block;">
                    <img :src="shapePreviewUrl(s)" alt="" width="32" height="32" />
                  </div>
                  <span class="icon-name">{{ s.label }}</span>
                </button>
              </div>

              <!-- bottom spacer -->
              <div :style="{ height: shapeBottomSpacer + 'px' }"></div>
            </div>
          </div>

          <!-- SHAPE CONTROLS (show when a shape is selected) -->
          <div v-if="isShapeImageSelected" class="controls">


            <div class="variant-row" :style="{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 0.5fr)',
              gridTemplateRows: 'repeat(3, 0.5fr)',
              alignContent: 'center'

            }">
              <div class="div1">
                <label>Style</label>
                <div class="buttons">
                  <button class="button"
                    :style="{ backgroundColor: selectedShapeStyle === 'filled' ? '#e3e6ea' : 'transparent', fontWeight: selectedShapeStyle === 'filled' ? 'bold' : 'normal' }"
                    @click="selectedShapeStyle = 'filled'">
                    Filled
                  </button>
                  <button class="button"
                    :style="{ backgroundColor: selectedShapeStyle === 'outline' ? '#e3e6ea' : 'transparent', fontWeight: selectedShapeStyle === 'outline' ? 'bold' : 'normal' }"
                    @click="selectedShapeStyle = 'outline'">
                    Outline
                  </button>
                </div>
              </div>
              <div class="div2">
                <label>Fill:</label>
                <input type="color" v-model="shapeFill" />
              </div>
              <div class="div3">
                <span>Stroke</span>
                <input type="color" v-model="shapeStroke" />
              </div>
              <div class="div4">
                <label style="margin-left:.5rem;">Stroke Width:</label>
                <WeightSlider v-model="shapeStrokeWidth" :min=0 :max=10 :step=1 />
              </div>
            </div>

            <div class="variant-row" v-if="selectedShapeType === 'rect'">
              <label>Corner Radius:</label>
              <input type="range" min="0" max="40" step="1" v-model.number="shapeCornerRadius" />
              <span>{{ shapeCornerRadius }}px</span>
            </div>

            <div class="variant-row" v-if="selectedShapeType === 'star'">
              <label>Points:</label>
              <input type="range" min="5" max="12" step="1" v-model.number="shapePoints" />
              <span>{{ shapePoints }}</span>
            </div>

            <div class="variant-row" v-if="selectedShapeType === 'polygon'">
              <label>Sides:</label>
              <input type="range" min="3" max="10" step="1" v-model.number="shapeSides" />
              <span>{{ shapeSides }}</span>
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
        <button class="autofill-btn yes" @click="() => {
          selectedBrand = ssactivewearBrand;
          newClothingName = ssactivewearStyle;
          showBrandSuggestions = false;
          autofillPrompt = '';
        }">Yes</button>
        <button class="autofill-btn no" @click="autofillPrompt = ''">No</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  /* =========================================================
     IMPORTS
     =======================================================*/
  import { ref, computed, watch, watchEffect, onMounted, onBeforeUnmount, toRef, nextTick, type Ref } from 'vue';

  import PlusIcon from 'vue-material-design-icons/Plus.vue';
  import CloseIcon from 'vue-material-design-icons/Close.vue';
  import uploadDark from './assets/uploadDark.png';

  import StyleOptions from './StyleOptions.vue';
  import FontPage from './FontPage.vue';

  import { useClothingStore } from '../../stores/clothingStore';
  import { supabase } from '../../supabase';
  import type { ImageObject, TextObject } from '../shirtlab/types';
  import { COLOR_OPTIONS, PRODUCT_COLORS, selectedProductColorIndex, setSelectedProductColorIndex } from './types/colorList';
  import WeightSlider from './TextAssets/WeightSlider.vue';

  /* =========================================================
     PROPS & EMITS
     =======================================================*/
  const emit = defineEmits<{
    (e: 'closeMenu'): void;
    (e: 'uploadObject', type: string, payload: any): void;
    (e: 'center-text'): void;
    (e: 'duplicate-text'): void;
    (e: 'bring-forward'): void;
    (e: 'send-back'): void;
    (e: 'shape-style', style: 'filled' | 'outline'): void;
  }>();

  const props = defineProps<{
    activeMenu: string;
    headerTitle: string;
    selectedObject: TextObject | ImageObject | any | null;
    draw: () => void;
  }>();

  // make the prop reactive (and typed)
  const selectedObject = toRef(props, 'selectedObject') as Ref<TextObject | ImageObject | any | null>;

  watch(selectedObject, (val) => {
    console.log('[MenuContent/watch] selectedObject ->', val);
  }, { immediate: true });

  watchEffect(() => {
    console.log('[MenuContent/watchEffect] selectedObject ->', selectedObject.value);
  });

  /* =========================================================
     GLOBAL UI STATE
     =======================================================*/
  const isDragging = ref(false);
  const fontPageRef = ref();

  /* =========================================================
     ICONS PANEL (Iconify)
     =======================================================*/
  type VariantKey =
    | 'default'
    | 'outlined'
    | 'filled'
    | 'rounded'
    | 'round'
    | 'sharp'
    | 'twotone'
    | 'two-tone'
    | 'outline';

  const iconPrefix = 'mdi';

  const suffixToVariant: Record<string, VariantKey> = {
    outlined: 'outlined',
    outline: 'outline',
    filled: 'filled',
    rounded: 'rounded',
    round: 'round',
    sharp: 'sharp',
    twotone: 'twotone',
    'two-tone': 'two-tone',
  };

  const previewPreference: VariantKey[] = [
    'default',
    'filled',
    'outlined',
    'rounded',
    'round',
    'sharp',
    'twotone',
    'two-tone',
    'outline',
  ];

  const currentVariant = ref<VariantKey>('default');
  const syncingVariantFromSelection = ref(false);

  const iconSearchQuery = ref<string>('');
  const iconLoading = ref(false);
  const iconError = ref<string | null>(null);

  const iconNames = ref<string[]>([]);

  function parseIconFromUrl(url: string): { prefix?: string; full?: string } {
    try {
      const m = url.match(/api\.iconify\.design\/([^/]+)\/([^/?]+)\.svg/i);
      if (m) return { prefix: m[1], full: m[2] };
    } catch { /* noop */ }
    return {};
  }

  function parseIconFromAny(so: any): { prefix?: string; full?: string } {
    // 1) Try URL first
    const byUrl = parseIconFromUrl(so?.imgUrl || so?.src || '');
    if (byUrl.full) return byUrl;

    // 2) Fallback to name like "mdi:home" or "material-symbols:star-outline"
    if (typeof so?.name === 'string' && so.name.includes(':')) {
      const [p, rest] = so.name.split(':');
      if (p && rest) return { prefix: p, full: rest };
    }

    return {};
  }

  const SHAPE_ID_PREFIX = 'shape';

  function parseShapeFromUrl(url: string): { key?: string } {
    try {
      if (!url || typeof url !== 'string') return {};
      // Look for fragment metadata like #shape=rect
      const frag = url.split('#')[1] || '';
      if (frag) {
        const qs = frag.startsWith('?') ? frag.slice(1) : frag;
        const params = new URLSearchParams(qs);
        const key = params.get('shape') || params.get('shapeKey');
        if (key) return { key };
      }
      // Also allow query param ?shape=rect just in case
      const q = url.split('?')[1] || '';
      if (q) {
        const params = new URLSearchParams(q);
        const key = params.get('shape') || params.get('shapeKey');
        if (key) return { key };
      }
    } catch { /* noop */ }
    return {};
  }

  function parseShapeFromAny(so: any): { key?: string; type?: ShapeType; meta?: Partial<ShapeMeta> } {
    if (!so) return {};

    // 1) Prefer existing meta
    if (so.shapeMeta && typeof so.shapeMeta === 'object') {
      const key = (so.shapeMeta.key as string) || undefined;
      const type = (so.shapeMeta.shapeType as ShapeType) || undefined;
      return { key, type, meta: so.shapeMeta };
    }

    // 2) Name like "shape:rect"
    if (typeof so.name === 'string' && so.name.startsWith(`${SHAPE_ID_PREFIX}:`)) {
      const key = so.name.slice(SHAPE_ID_PREFIX.length + 1);
      const item = SHAPES.find(s => s.key === key);
      return { key, type: item?.type };
    }

    // 3) Data URL with fragment #shape=
    const url = typeof so.imgUrl === 'string' ? so.imgUrl : (typeof so.src === 'string' ? so.src : '');
    const byUrl = parseShapeFromUrl(url);
    if (byUrl.key) {
      const item = SHAPES.find(s => s.key === byUrl.key);
      return { key: byUrl.key, type: item?.type };
    }

    return {};
  }

  const selectedIconInfo = computed(() => {
    const so = selectedObject.value as any;
    if (!so || so.type !== 'image') return null;
    // ignore shapes masquerading as images
    if (so.shapeMeta || (typeof so.name === 'string' && so.name.startsWith('shape:'))) return null;

    const { full, prefix } = parseIconFromAny(so);
    if (!full) return null;

    const parts = full.split('-');
    const last = parts[parts.length - 1];
    const variant: VariantKey = suffixToVariant[last] ?? 'default';
    const base = variant === 'default' ? full : parts.slice(0, -1).join('-');
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
      const parts = full.split('-');
      const last = parts[parts.length - 1];
      const variant: VariantKey = suffixToVariant[last] ?? 'default';
      const base = variant === 'default' ? full : parts.slice(0, -1).join('-');

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
    return iconGroups.value.find(g => g.base === selectedIconInfo.value!.base) || null;
  });

  const showSwatchPanel = ref(false);

  function applyIconColor(opt: { name: string; color: string }) {
    textColor.value = opt.name === 'None' ? '' : opt.color;
  }

  function openSwatchPanel() { showSwatchPanel.value = true; }
  function closeSwatchPanel() { showSwatchPanel.value = false; }
  function applyAndClose(c: { name: string; color: string }) {
    applyIconColor(c);
    closeSwatchPanel();
  }

  const selectedIconVariants = computed<VariantKey[]>(() => selectedGroup.value?.variants ?? ['default']);

  function prettyVariant(v: VariantKey) {
    switch (v) {
      case 'twotone': return 'TwoTone';
      case 'two-tone': return 'Two-Tone';
      case 'round': return 'Round';
      default: return v[0].toUpperCase() + v.slice(1);
    }
  }

  const filteredGroups = computed(() => {
    const q = (iconSearchQuery.value || '').toLowerCase().trim();
    const baseMap = (g: IconGroup) => {
      const def = g.entries.find(e => e.variant === 'default');
      return def ? { ...g, entries: [def] } : g;
    };
    return (q ? iconGroups.value.filter(g => g.base.includes(q)) : iconGroups.value).map(baseMap);
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
    if (showSwatchPanel.value && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
      closeSwatchPanel();
    }
  }

  onMounted(() => {
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    window.addEventListener('keydown', onKeydown);
    if (props.activeMenu === 'Icons') loadIconsOnce();
  });
  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onGlobalPointerDown, true);
    window.removeEventListener('keydown', onKeydown);
  });

  watch(() => props.activeMenu, (val) => {
    if (val === 'Icons') loadIconsOnce();
  }, { immediate: true });

  watch([selectedIconInfo, iconGroups], ([info, groups]) => {
    if (!info) return;
    const g = groups.find(gr => gr.base === info.base);
    if (!g) return;
    syncingVariantFromSelection.value = true;
    currentVariant.value = g.variants.includes(info.variant)
      ? info.variant
      : (previewPreference.find(v => g.variants.includes(v)) ?? g.variants[0]);
    queueMicrotask(() => { syncingVariantFromSelection.value = false; });
  }, { immediate: true });

  function iconUrlWithPrefix(prefix: string, fullName: string, size = 48) {
    return `https://api.iconify.design/${prefix}/${fullName}.svg?height=${size}`;
  }

  watch(currentVariant, (v) => {
    if (syncingVariantFromSelection.value) return;
    const g = selectedGroup.value;
    const so = selectedObject.value as any;
    if (!so || so.type !== 'image' || !g) return;

    const entry =
      g.entries.find(e => e.variant === v) ||
      g.entries.find(e => e.variant === 'default') ||
      g.entries[0];
    if (!entry) return;

    const chosenPrefix = selectedIconInfo.value?.prefix || iconPrefix;
    const newUrl = buildIconApiUrl(
      chosenPrefix,
      entry.full,
      1024,
      textColor.value || undefined
    );

    so.imgUrl = newUrl;
    so.isVector = true;

    if (so.img && typeof so.img === 'object') {
      so.img.onload = () => props.draw();
      so.img.crossOrigin = 'anonymous';
      so.img.src = newUrl;
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => props.draw();
      img.src = newUrl;
      so.img = img;
    }

    try { so.name = `${chosenPrefix}:${entry.full}`; } catch { /* noop */ }
  }, { flush: 'post' });

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
        if (j2?.categories && typeof j2.categories === 'object') {
          for (const arr of Object.values<string[]>(j2.categories)) catNames.push(...arr);
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
      console.log('[Icons] loaded', iconPrefix, iconNames.value.length, 'names');
    } catch (err: any) {
      iconError.value = err?.message || 'Failed to load icons';
      console.error('[Icons] load error:', err);
    } finally {
      iconLoading.value = false;
    }
  }

  onMounted(() => {
    if (props.activeMenu === 'Icons') loadIconsOnce();
  });
  watch(
    () => props.activeMenu,
    (val) => {
      if (val === 'Icons') loadIconsOnce();
    },
    { immediate: true }
  );

  // choose the actual name to preview for a group (default-first)
  function pickEntryForPreview(g: IconGroup): string {
    const exact = g.entries.find(e => e.variant === 'default');
    if (exact) return exact.full;
    for (const v of previewPreference) {
      const found = g.entries.find(e => e.variant === v);
      if (found) return found.full;
    }
    return g.entries[0]?.full || g.base;
  }

  // build URL from the full icon name (current collection)
  function iconUrl(fullName: string, size = 48) {
    return `https://api.iconify.design/${iconPrefix}/${fullName}.svg?height=${size}`;
  }

  // click → place selected variant if exists else fallback
  function chooseIcon(g: IconGroup) {
    const name = pickEntryForPreview(g);
    emit('uploadObject', 'image', {
      imgUrl: buildIconApiUrl(iconPrefix, name, 512, textColor.value || undefined),
      isVector: true,
      name: `${iconPrefix}:${name}`,
    });
  }

  /* =========================================================
     SHAPES TAB — catalog, search (debounced), virtualization, controls
     =======================================================*/

  type ShapeType =
    | 'rect' | 'circle' | 'ellipse' | 'triangle'
    | 'star' | 'arrow' | 'polygon' | 'heart'
    | 'line' | 'path';

  type ShapeItem = {
    key: string;
    label: string;
    type: ShapeType;          // matches template v-ifs
    previewPoints?: string;   // for polygons/stars (100x100 coord space)
    previewPath?: string;     // for path-based shapes (100x100 coord space)
    init?: Partial<{
      points: number;         // stars
      sides: number;          // polygons
      cornerRadius: number;   // rect/square
      style: 'filled' | 'outline';
    }>;
  };

  // helpers to build previews
  function polygonPoints(sides: number, r: number, cx: number, cy: number, rotRad = -Math.PI / 2): string {
    const pts: string[] = [];
    for (let i = 0; i < sides; i++) {
      const a = rotRad + (i * 2 * Math.PI) / sides;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  }
  function starPoints(n: number, r1: number, r2: number, cx: number, cy: number): string {
    const pts: string[] = [];
    const step = Math.PI / n;
    let a = -Math.PI / 2;
    for (let i = 0; i < 2 * n; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
      a += step;
    }
    return pts.join(' ');
  }

  // simple paths for preview (100x100)
  const HEART_PATH = 'M50 82 C 20 62, 12 40, 26 28 C 36 20, 50 24, 50 34 C 50 24, 64 20, 74 28 C 88 40, 80 62, 50 82 Z';
  const ARROW_RIGHT = 'M20 50 H70 M55 35 L70 50 L55 65';
  const ARROW_LEFT = 'M80 50 H30 M45 35 L30 50 L45 65';
  const ARROW_UP = 'M50 80 V30 M35 45 L50 30 L65 45';
  const ARROW_DOWN = 'M50 20 V70 M35 55 L50 70 L65 55';
  const CHECK_PATH = 'M22 52 L42 72 L78 28';
  const CROSS_PATH = 'M28 28 L72 72 M72 28 L28 72';
  const PLUS_PATH = 'M50 20 V80 M20 50 H80';
  const CLOUD_PATH = 'M32 70 H70 a14 14 0 0 0 0 -28 a16 16 0 0 0 -31 -5 a12 12 0 0 0 -3 23 z';
  const BUBBLE_PATH = 'M22 32 h56 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-24 l-14 12 v-12 h-18 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z';

  const SHAPES: ShapeItem[] = [
    { key: 'rect', label: 'Rectangle', type: 'rect', init: { cornerRadius: 12 } },
    { key: 'square', label: 'Square', type: 'rect', init: { cornerRadius: 12 } },
    { key: 'circle', label: 'Circle', type: 'circle' },
    { key: 'ellipse', label: 'Ellipse', type: 'ellipse' },
    { key: 'triangle', label: 'Triangle', type: 'triangle' },

    { key: 'diamond', label: 'Diamond', type: 'polygon', previewPoints: polygonPoints(4, 34, 50, 50, Math.PI / 4), init: { sides: 4 } },
    { key: 'pentagon', label: 'Pentagon', type: 'polygon', previewPoints: polygonPoints(5, 34, 50, 50), init: { sides: 5 } },
    { key: 'hexagon', label: 'Hexagon', type: 'polygon', previewPoints: polygonPoints(6, 34, 50, 50), init: { sides: 6 } },
    { key: 'octagon', label: 'Octagon', type: 'polygon', previewPoints: polygonPoints(8, 32, 50, 50), init: { sides: 8 } },

    { key: 'star5', label: 'Star (5)', type: 'star', previewPoints: starPoints(5, 34, 15, 50, 50), init: { points: 5 } },
    { key: 'star6', label: 'Star (6)', type: 'star', previewPoints: starPoints(6, 34, 16, 50, 50), init: { points: 6 } },

    { key: 'heart', label: 'Heart', type: 'heart', previewPath: HEART_PATH },

    { key: 'arrow-right', label: 'Arrow →', type: 'arrow', previewPath: ARROW_RIGHT },
    { key: 'arrow-left', label: 'Arrow ←', type: 'arrow', previewPath: ARROW_LEFT },
    { key: 'arrow-up', label: 'Arrow ↑', type: 'arrow', previewPath: ARROW_UP },
    { key: 'arrow-down', label: 'Arrow ↓', type: 'arrow', previewPath: ARROW_DOWN },

    { key: 'line-h', label: 'Line —', type: 'path', previewPath: 'M20 50 H80', init: { style: 'outline' } },
    { key: 'line-v', label: 'Line |', type: 'path', previewPath: 'M50 20 V80', init: { style: 'outline' } },
    { key: 'plus', label: 'Plus', type: 'path', previewPath: PLUS_PATH, init: { style: 'outline' } },
    { key: 'cross', label: 'Cross', type: 'path', previewPath: CROSS_PATH, init: { style: 'outline' } },
    { key: 'check', label: 'Check', type: 'path', previewPath: CHECK_PATH, init: { style: 'outline' } },

    { key: 'cloud', label: 'Cloud', type: 'path', previewPath: CLOUD_PATH },
    { key: 'chat-bubble', label: 'Chat Bubble', type: 'path', previewPath: BUBBLE_PATH },
  ];

  /* ---------- NEW: helpers to generate an SVG image (data URL) ---------- */

  // ---- ICON COLOR STATE + HELPERS ----
  // shows "None" or the color's friendly name
  const currentSwatchName = computed(() => {
    if (!textColor.value) return 'None';
    const all = Object.values(COLOR_OPTIONS);
    return all.find(c => c.color === textColor.value)?.name || textColor.value;
  });
  const textColor = ref<string>(''); // '' = no override (use icon's default)

  function buildIconApiUrl(prefix: string, fullName: string, size = 48, color?: string) {
    let u = `https://api.iconify.design/${prefix}/${fullName}.svg?height=${size}`;
    if (color && color !== 'none') u += `&color=${encodeURIComponent(color)}`;
    return u;
  }

  function applySelectedIconColor() {
    const so = selectedObject.value as any;
    const info = selectedIconInfo.value;
    if (!so || !info) return; // nothing selected or not an icon

    const chosenPrefix = info.prefix || iconPrefix;
    const newUrl = buildIconApiUrl(chosenPrefix, info.full!, 1024, textColor.value || undefined);

    so.imgUrl = newUrl;
    so.isVector = true;

    if (so.img && typeof so.img === 'object') {
      so.img.onload = () => props.draw();
      so.img.crossOrigin = 'anonymous';
      so.img.src = newUrl;
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => props.draw();
      img.src = newUrl;
      so.img = img;
    }
    try { so.name = `${chosenPrefix}:${info.full}`; } catch { /* noop */ }
  }

  // whenever the swatch changes, recolor the selected icon
  watch(textColor, () => applySelectedIconColor());

  // optional: when selection changes, try to sync textColor from URL (?color=...)
  function parseColorParam(url: string): string {
    try {
      const q = url.split('?')[1] || '';
      const p = new URLSearchParams(q);
      const c = p.get('color');
      return c ? decodeURIComponent(c) : '';
    } catch { return ''; }
  }
  watch(selectedObject, (so) => {
    if (!so || typeof so.imgUrl !== 'string') return;
    textColor.value = parseColorParam(so.imgUrl || '');
  });

  type ShapeMeta = {
    key: string;
    shapeType: ShapeType;
    style: 'filled' | 'outline';
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius: number;
    points: number;
    sides: number;
    width: number;   // output image size
    height: number;  // output image size
    // optional: for path/polygon we can reuse preview data
    previewPath?: string;
    previewPoints?: string;
  };
  type ArrowDir = 'right' | 'left' | 'up' | 'down';

  /** 0..100 coords; insetU = half-stroke (in 0..100 units) */
  function arrowPoints(
    dir: ArrowDir,
    insetU = 0,
    shaftPct = 26,      // thickness of the shaft (% of height/width)
    headLenPct = 28,    // how long the head is
    headWidthScale = 1.6 // how wide the head is vs shaft
  ): string {
    const c = 50;
    const halfT = shaftPct / 2;
    const headLen = headLenPct;
    const headHalfW = halfT * headWidthScale;

    switch (dir) {
      case 'right': {
        const L = insetU, R = 100 - insetU, base = R - headLen;
        return `${L},${c - halfT} ${base},${c - halfT} ${base},${c - headHalfW} ${R},${c} ${base},${c + headHalfW} ${base},${c + halfT} ${L},${c + halfT}`;
      }
      case 'left': {
        const L = insetU, R = 100 - insetU, base = L + headLen;
        return `${R},${c - halfT} ${base},${c - halfT} ${base},${c - headHalfW} ${L},${c} ${base},${c + headHalfW} ${base},${c + halfT} ${R},${c + halfT}`;
      }
      case 'up': {
        const T = insetU, B = 100 - insetU, base = T + headLen;
        return `${50 - halfT},${B} ${50 - halfT},${base} ${50 - headHalfW},${base} 50,${T} ${50 + headHalfW},${base} ${50 + halfT},${base} ${50 + halfT},${B}`;
      }
      default: { // 'down'
        const T = insetU, B = 100 - insetU, base = B - headLen;
        return `${50 - halfT},${T} ${50 - halfT},${base} ${50 - headHalfW},${base} 50,${B} ${50 + headHalfW},${base} ${50 + halfT},${base} ${50 + halfT},${T}`;
      }
    }
  }

  function escXml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function svgDataUrl(svg: string) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  function svgDataUrlWithId(svg: string, shapeKey: string) {
    // Append a fragment so we can recover identity later
    return `${svgDataUrl(svg)}#shape=${encodeURIComponent(shapeKey)}`;
  }
  function scaleNumbers(str: string, scale: number): string {
    return str.replace(/-?\d*\.?\d+/g, n => (parseFloat(n) * scale).toFixed(2));
  }
  function shapePreviewUrl(s: ShapeItem): string {
    // defaults
    let style: 'filled' | 'outline' = (s.init?.style ?? 'filled') as any;
    let strokeWidth = 2;

    // force outline + thicker stroke for path-based shapes
    if (['plus', 'cross', 'check', 'line-h', 'line-v'].includes(s.key)) {
      style = 'outline';
      strokeWidth = 6;
    }

    const meta: ShapeMeta = {
      key: s.key,
      shapeType: s.type,
      style,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth,
      cornerRadius: s.init?.cornerRadius ?? 12,
      points: s.init?.points ?? 5,
      sides: s.init?.sides ?? (s.type === 'polygon' ? 6 : 0),
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

    const insetU = m.style === 'outline' ? (m.strokeWidth / 2) / scale : 0;

    const common =
      m.style === 'filled'
        ? `fill="${escXml(m.fill)}" stroke="none"`
        : `fill="none" stroke="${escXml(m.stroke)}" stroke-width="${m.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;

    let inner = '';
    let useUnitViewBox = false; // <— NEW

    switch (m.shapeType) {
      case 'rect': {
        const x = insetU, y = insetU;
        const w = 100 - insetU * 2, h = 100 - insetU * 2;
        const rx = Math.max(0, m.cornerRadius ?? 0);
        // keep using scaled coords
        inner = `<rect x="${(x * scale).toFixed(2)}" y="${(y * scale).toFixed(2)}" width="${(w * scale).toFixed(2)}" height="${(h * scale).toFixed(2)}" rx="${(rx * scale).toFixed(2)}" ry="${(rx * scale).toFixed(2)}" ${common} />`;
        break;
      }
      case 'circle': {
        const r = 50 - insetU;
        inner = `<circle cx="${(50 * scale).toFixed(2)}" cy="${(50 * scale).toFixed(2)}" r="${(r * scale).toFixed(2)}" ${common} />`;
        break;
      }
      case 'ellipse': {
        const rx = 50 - insetU, ry = 40 - insetU;
        inner = `<ellipse cx="${(50 * scale).toFixed(2)}" cy="${(50 * scale).toFixed(2)}" rx="${(rx * scale).toFixed(2)}" ry="${(ry * scale).toFixed(2)}" ${common} />`;
        break;
      }
      case 'triangle': {
        const mU = insetU;
        const pts = `${50},${mU} ${100 - mU},${100 - mU} ${mU},${100 - mU}`;
        inner = `<polygon points="${escXml(scaleNumbers(pts, scale))}" ${common} />`;
        break;
      }
      case 'polygon': {
        const R = 50 - insetU;
        const pts = polygonPoints(m.sides || 6, R, 50, 50);
        inner = `<polygon points="${escXml(scaleNumbers(pts, scale))}" ${common} />`;
        break;
      }
      case 'star': {
        const R = 50 - insetU, r = R * 0.45;
        const pts = starPoints(m.points || 5, R, r, 50, 50);
        inner = `<polygon points="${escXml(scaleNumbers(pts, scale))}" ${common} />`;
        break;
      }
      case 'arrow': {
        const k = (m.key || '').toLowerCase();
        const dir: ArrowDir = k.includes('left') ? 'left' : k.includes('up') ? 'up' : k.includes('down') ? 'down' : 'right';
        const pts = arrowPoints(dir, insetU);
        inner = `<polygon points="${escXml(scaleNumbers(pts, scale))}" ${common} />`;
        break;
      }
      case 'heart':
      case 'line':
      case 'path': {
        // 🔧 IMPORTANT: do NOT scale arc flags in paths — keep 0..100 coordinates
        const d = m.previewPath || 'M20 50 H80';
        inner = `<path d="${escXml(d)}" ${common} />`;
        useUnitViewBox = true; // <— NEW: draw in 0..100 space
        break;
      }
      default: {
        const d = m.previewPath || 'M0 50 H100';
        inner = `<path d="${escXml(d)}" ${common} />`;
        useUnitViewBox = true;
      }
    }

    const vb = useUnitViewBox ? `0 0 100 100` : `0 0 ${W} ${H}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${W}" height="${H}">${inner}</svg>`;
  }

  /* ---------- Search (debounced) ---------- */
  const shapeSearchQuery = ref('');
  const shapeSearchTerm = ref('');
  let _shapeSearchTimer: number | undefined;
  watch(shapeSearchQuery, (v) => {
    if (_shapeSearchTimer) window.clearTimeout(_shapeSearchTimer);
    _shapeSearchTimer = window.setTimeout(() => (shapeSearchTerm.value = v), 140);
  });

  const allShapes = computed<ShapeItem[]>(() => [...SHAPES].sort((a, b) => a.label.localeCompare(b.label)));
  const filteredShapes = computed<ShapeItem[]>(() => {
    const q = shapeSearchTerm.value.trim().toLowerCase();
    return q
      ? allShapes.value.filter(s => s.label.toLowerCase().includes(q) || s.key.includes(q))
      : allShapes.value;
  });

  /* ---------- Virtualization ---------- */
  const shapeScrollRef = ref<HTMLDivElement | null>(null);
  const shapeContainerH = ref(0);
  const shapeContainerW = ref(0);
  const shapeScrollTop = ref(0);

  const COL_MIN = 96;   // px incl. padding/gap
  const ROW_H = 112;  // px approx tile height incl. gap
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
      el.addEventListener('scroll', () => { shapeScrollTop.value = el.scrollTop; }, { passive: true });
    }
    shapeResizeObs = new ResizeObserver(measureShapeContainer);
    if (el) shapeResizeObs.observe(el);
    measureShapeContainer();
  });
  onBeforeUnmount(() => {
    if (shapeResizeObs && shapeScrollRef.value) shapeResizeObs.unobserve(shapeScrollRef.value);
    shapeResizeObs = null;
  });

  const shapeCols = computed(() => Math.max(1, Math.floor((shapeContainerW.value + 8) / COL_MIN)));
  const shapeTotalRows = computed(() => Math.ceil(filteredShapes.value.length / shapeCols.value));
  const shapeVisibleRowCount = computed(() => Math.ceil(shapeContainerH.value / ROW_H) + BUFFER_ROWS * 2);
  const shapeStartRow = computed(() => Math.max(0, Math.floor(shapeScrollTop.value / ROW_H) - BUFFER_ROWS));
  const shapeEndRow = computed(() => Math.min(shapeTotalRows.value, shapeStartRow.value + shapeVisibleRowCount.value));
  const shapeStartIdx = computed(() => shapeStartRow.value * shapeCols.value);
  const shapeEndIdx = computed(() => Math.min(filteredShapes.value.length, shapeEndRow.value * shapeCols.value));

  const visibleShapes = computed(() =>
    filteredShapes.value.slice(shapeStartIdx.value, shapeEndIdx.value)
  );
  const shapeTopSpacer = computed(() => shapeStartRow.value * ROW_H);
  const shapeBottomSpacer = computed(() => Math.max(0, (shapeTotalRows.value - shapeEndRow.value) * ROW_H));

  watch(shapeSearchTerm, () => {
    const el = shapeScrollRef.value;
    if (el) el.scrollTop = 0;
    shapeScrollTop.value = 0;
  });

  watch(() => props.activeMenu, async (val) => {
    if (val === 'Shapes') {
      await nextTick();
      const el = shapeScrollRef.value;
      if (el) {
        // attach listeners if not attached yet
        el.addEventListener('scroll', () => { shapeScrollTop.value = el.scrollTop; }, { passive: true });
        if (!shapeResizeObs) {
          shapeResizeObs = new ResizeObserver(measureShapeContainer);
        }
        try { shapeResizeObs.observe(el); } catch { }
        measureShapeContainer();
      }
    }
  });

  /* ---------- NEW: detect selected *shape image* (identifier-based) ---------- */
  const selectedShapeInfo = computed(() => {
    const so = selectedObject.value as any;
    const info = parseShapeFromAny(so);
    console.log(info)
    return info.key ? info : null;
  });

  /* ---------- Selection classification: icon by URL -> else shape -> else regular image ---------- */
  function getImgUrl(so: any): string {
    return typeof so?.imgUrl === 'string' ? so.imgUrl : (typeof so?.src === 'string' ? so.src : '');
  }
  function isIconifySvgUrl(url: string): boolean {
    // strict match using the same parser used elsewhere
    return !!parseIconFromUrl(url).full;
  }

  const selectionKind = computed(() => {
    const so = selectedObject.value as any;
    if (!so || so.type !== 'image') return { isIcon: false, isShape: false, isImage: false };

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
  const isRegularImageSelected = computed(() => selectionKind.value.isImage);

  // For template v-ifs (works even if only the identifier is present)
  const selectedShapeType = computed<ShapeType | undefined>(() => {
    const metaType = selectedObject.value?.shapeMeta?.shapeType as ShapeType | undefined;
    if (metaType) return metaType;

    const info = selectedShapeInfo.value;
    if (info?.type) return info.type;

    if (info?.key) return SHAPES.find(s => s.key === info.key)?.type as ShapeType | undefined;
    return undefined;
  });



  /* ---------- Controls state (optional; lets you re-generate the SVG on changes) ---------- */
  // Helper to ensure shapeMeta is present on selectedObject (if not, create it)
  function ensureShapeMeta(so: any): ShapeMeta | undefined {
    if (!so) return undefined;
    if (!so.shapeMeta) {
      const info = parseShapeFromAny(so);
      const key = info.key || 'rect';
      const item = SHAPES.find(s => s.key === key);

      // sensible defaults
      const outlineOnly = new Set(['line-h', 'line-v', 'plus', 'cross', 'check']);
      const defaultStrokeWidth = outlineOnly.has(key) ? 8 : 2;

      const meta: ShapeMeta = {
        key,
        shapeType: (info.type as ShapeType) || item?.type || 'rect',
        style: ((info.meta?.style as 'filled' | 'outline') || (item?.init?.style as any) || 'filled'),
        fill: (info.meta?.fill as string) || '#000000',
        stroke: (info.meta?.stroke as string) || '#000000',
        strokeWidth: Number.isFinite(info.meta?.strokeWidth as any) ? (info.meta!.strokeWidth as number) : defaultStrokeWidth,
        cornerRadius: Number.isFinite(info.meta?.cornerRadius as any) ? (info.meta!.cornerRadius as number) : (item?.init?.cornerRadius ?? 12),
        points: Number.isFinite(info.meta?.points as any) ? (info.meta!.points as number) : (item?.init?.points ?? 5),
        sides: Number.isFinite(info.meta?.sides as any) ? (info.meta!.sides as number) : (item?.init?.sides ?? (item?.type === 'polygon' ? 6 : 0)),
        width: 512,
        height: 512,
        previewPath: item?.previewPath,
        previewPoints: item?.previewPoints,
      };
      so.shapeMeta = meta;
      if (typeof so.name !== 'string' || !so.name.startsWith('shape:')) {
        try { so.name = `shape:${key}`; } catch { }
      }
    }
    return so.shapeMeta as ShapeMeta;
  }

  // expose reactive wrappers for controls (use ensureShapeMeta)
  const selectedShapeStyle = computed({
    get: () => {
      const so = selectedObject.value as any;
      const m = ensureShapeMeta(so);
      return (m?.style as 'filled' | 'outline') ?? 'filled';
    },
    set: (val: 'filled' | 'outline') => {
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
      return m?.fill ?? '#000000';
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
      return m?.stroke ?? '#000000';
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
      selectedShapeStyle.value = (meta.style as any) ?? 'filled';
      shapeFill.value = (meta.fill as any) ?? '#000000';
      shapeStroke.value = (meta.stroke as any) ?? '#000000';
      shapeStrokeWidth.value = Number.isFinite(meta.strokeWidth as any) ? (meta.strokeWidth as number) : 2;
      shapeCornerRadius.value = Number.isFinite(meta.cornerRadius as any) ? (meta.cornerRadius as number) : 12;
      shapePoints.value = Number.isFinite(meta.points as any) ? (meta.points as number) : 5;
      shapeSides.value = Number.isFinite(meta.sides as any) ? (meta.sides as number) : (meta.shapeType === 'polygon' ? 6 : 0);
    }
    queueMicrotask(() => (syncingShapeFromSelection.value = false));
  }
  watch(selectedObject, syncFromSelectedShapeImage, { immediate: true });

  function applyToSelectedShapeImage() {
    if (syncingShapeFromSelection.value) return;
    const so = selectedObject.value as any;
    if (!isShapeImageSelected.value || !so) return;

    const baseKey = typeof so.name === 'string' && so.name.startsWith('shape:') ? so.name.slice(6) : (so.shapeMeta?.key || 'rect');
    const inferredType = SHAPES.find(s => s.key === baseKey)?.type as ShapeType | undefined;
    const meta: ShapeMeta = {
      key: baseKey,
      shapeType: so.shapeMeta?.shapeType || inferredType || 'rect',
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
    so.imgUrl = url;
    so.isVector = true;

    if (so.img && typeof so.img === 'object') {
      so.img.onload = () => props.draw();
      so.img.crossOrigin = 'anonymous';
      so.img.src = url;
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => props.draw();
      img.src = url;
      so.img = img;
    }
    try { so.name = `shape:${meta.key}`; } catch { }
  }
  watch([selectedShapeStyle, shapeFill, shapeStroke, shapeStrokeWidth, shapeCornerRadius, shapePoints, shapeSides], applyToSelectedShapeImage);

  /* ---------- CLICK: now creates an IMAGE (SVG data URL) ---------- */
  function chooseShape(s: ShapeItem) {
    const OUTLINE_ONLY = new Set(['line-h', 'line-v', 'plus', 'cross', 'check']);
    const FILL_ALWAYS = new Set(['cloud', 'chat-bubble']);

    let style: 'filled' | 'outline';
    let strokeWidth = 2;

    if (OUTLINE_ONLY.has(s.key)) {
      style = 'outline';
      strokeWidth = 8; // visible at small size
    } else if (FILL_ALWAYS.has(s.key)) {
      style = 'filled';
    } else {
      style = (s.init?.style ?? 'filled') as any;
    }

    const meta: ShapeMeta = {
      key: s.key,
      shapeType: s.type,
      style,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth,
      cornerRadius: s.init?.cornerRadius ?? 12,
      points: s.init?.points ?? 5,
      sides: s.init?.sides ?? (s.type === 'polygon' ? 6 : 0),
      width: 512,
      height: 512,
      previewPath: s.previewPath,
      previewPoints: s.previewPoints,
    };

    const svg = svgFromShapeMeta(meta);
    const url = svgDataUrlWithId(svg, meta.key);

    emit('uploadObject', 'image', {
      imgUrl: url,
      isVector: true,
      name: `shape:${s.key}`,
      shapeMeta: meta,
    });
  }

  /* =========================================================
     IMAGE UPLOAD (files, drag/drop, validation)
     =======================================================*/
  const fileInput = ref<HTMLInputElement | null>(null);
  const allowedTypes = [
    'image/png',
    'image/ai',
    'image/eps',
    'image/pdf',
    'image/heic',
    'image/avif',
    'image/tiff',
    'image/svg+xml',
  ];
  const maxFileSizeMB = 20;

  const allowedTypesDisplay = computed(() =>
    allowedTypes.map((t) => t.split('/')[1].toUpperCase()).join(', ')
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
      emit('uploadObject', 'image', { imgUrl: URL.createObjectURL(files[0]) });
    } else {
      alert(`File must be one of: ${allowedTypes.join(', ')} and under ${maxFileSizeMB}MB`);
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
      emit('uploadObject', 'image', { imgUrl: URL.createObjectURL(files[0]) });
    } else {
      alert(`File must be one of: ${allowedTypes.join(', ')} and under ${maxFileSizeMB}MB`);
    }
  }

  /* =========================================================
     CLOTHING CREATE FLOW (brand, sizes, genders)
     =======================================================*/
  const clothingStore = useClothingStore();
  const isCreating = ref(false);

  // brand suggestions
  const allBrands = ['BELLA + CANVAS', 'Gildan', 'Hanes', 'Tultex', 'H&M', 'Nike', 'Uniqlo', 'Gap', 'J.Crew'];
  const selectedBrand = ref('');
  const showBrandSuggestions = ref(true);
  const filteredBrands = computed(() =>
    showBrandSuggestions.value
      ? allBrands.filter((b) => b.toLowerCase().includes(selectedBrand.value.toLowerCase()) && selectedBrand.value)
      : []
  );
  function selectBrand(brand: string) {
    selectedBrand.value = brand;
    showBrandSuggestions.value = false;
  }

  // live categories & genders (from DB)
  const categories = ref<any[]>([]);
  const gendersList = ref<any[]>([]);

  onMounted(async () => {
    const { data: categoriesData } = await supabase.from('categories').select('*').order('code', { ascending: true });
    const { data: gendersData } = await supabase.from('genders').select('*').order('code', { ascending: true });

    if (categoriesData) categories.value = categoriesData as any[];
    if (gendersData) gendersList.value = gendersData as any[];
  });

  // new clothing form state
  const showCreateForm = ref(false);
  const newClothingName = ref('');
  const newClothingCategory = ref('');
  const newClothingSizes = ref<string[]>([]);
  const newClothingGenders = ref<string[]>([]);
  const newClothingImage = ref<any>(null);

  // autofill prompt
  const autofillPrompt = ref('');
  const ssactivewearBrand = ref('');
  const ssactivewearStyle = ref('');

  // sizes
  const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  /* =========================================================
     SSACTIVEWEAR FETCH (colors / brand / style)
     =======================================================*/
  const ssactivewearUrl = ref('');
  const ssactivewearColors = ref<any[]>([]);
  const isFetchingColors = ref(false);

  const productColors = computed(() => PRODUCT_COLORS.value);
  const productColorIndex = computed(() => selectedProductColorIndex.value);

  function handleProductColorClick(index: number) {
    setSelectedProductColorIndex(index);
  }

  function swatchStyle(color: any) {
    const style: Record<string, string> = {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
    if (color?.hex) {
      style.background = color.hex;
      style.backgroundImage = 'none';
    } else if (color?.frontUrl) {
      style.backgroundImage = `url(${color.frontUrl})`;
    } else {
      style.background = '#e5e7eb';
    }
    return style;
  }

  async function fetchSSActivewearColors() {
    if (!ssactivewearUrl.value) return;
    isFetchingColors.value = true;
    ssactivewearColors.value = [];
    try {
      const match = ssactivewearUrl.value.match(/\/([^\/?#]+)$/);
      const productId = match ? match[1] : null;
      if (!productId) throw new Error('Could not extract productId from SSActivewear URL');

      const endpoint = 'https://xtjikprktetrshhpbeca.supabase.co/functions/v1/ssactivewear-proxy';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, url: ssactivewearUrl.value }),
      });
      if (!response.ok) throw new Error('Failed to fetch from SSActivewear API');

      const data = await response.json();

      if (Array.isArray(data.colors)) {
        ssactivewearColors.value = data.colors;
      }
      if (data.brand) {
        autofillPrompt.value = `Autofill brand with "${data.brand}"?`;
        ssactivewearBrand.value = data.brand;
      }
      ssactivewearStyle.value = data.style ? data.style : '';
    } catch (error) {
      console.error('Error fetching SSActivewear info:', error);
    } finally {
      isFetchingColors.value = false;
    }
  }

  /* =========================================================
     CLOTHING HELPERS (create/save/cancel)
     =======================================================*/
  function autoSetClothingImageAndSendToStore() {
    newClothingImage.value = ssactivewearColors.value[0]?.colorBackground || '';

    clothingStore.createClothing({
      name: newClothingName.value,
      category: newClothingCategory.value,
      sizes: newClothingSizes.value,
      genders: newClothingGenders.value,
      grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
      brand: selectedBrand.value,
      colors: ssactivewearColors.value.map((color: any) => ({
        name: color.name || color,
        colorBackground: color.colorBackground || '',
        colorStyleID: color.colorStyleID || '',
        background: color.background || '',
      })),
    });
  }

  function startCreating() {
    isCreating.value = true;
    showCreateForm.value = true;
    clothingStore.setIsCreating(true);
  }

  async function saveNewClothing() {
    // Optional: upload manual image to Supabase Storage
    let uploadedSupabaseUrl = '';
    if (newClothingImage.value && newClothingImage.value.name) {
      const { data, error } = await supabase
        .storage
        .from('clothing-images')
        .upload(`public/${Date.now()}-${newClothingImage.value.name}`, newClothingImage.value);
      if (error) {
        console.error('Supabase upload error:', error);
        return;
      }
      uploadedSupabaseUrl = supabase.storage.from('clothing-images').getPublicUrl(data.path).data.publicUrl;
    }

    // DB row
    const { error: insertError } = await supabase.from('clothing_items').insert([
      {
        name: newClothingName.value,
        category: newClothingCategory.value,
        sizes: newClothingSizes.value,
        genders: newClothingGenders.value,
        grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
        brand: selectedBrand.value,
        colors: ssactivewearColors.value.map((color: any) => ({
          name: color.name || color,
          colorBackground: color.colorBackground || '',
          colorStyleID: color.colorStyleID || '',
          background: color.background || '',
        })),
      },
    ]);
    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return;
    }

    // mirror to local store
    clothingStore.createClothing({
      name: newClothingName.value,
      category: newClothingCategory.value,
      sizes: newClothingSizes.value,
      genders: newClothingGenders.value,
      grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
      brand: selectedBrand.value,
      colors: ssactivewearColors.value.map((color: any) => ({
        name: color.name || color,
        colorBackground: color.colorBackground || '',
        colorStyleID: color.colorStyleID || '',
        background: color.background || '',
      })),
    });

    clothingStore.setIsCreating(false);
    showCreateForm.value = false;
    isCreating.value = false;
  }

  function cancelCreating() {
    showCreateForm.value = false;
    isCreating.value = false;
    clothingStore.setIsCreating(false);
  }

  /* =========================================================
     MENU CONTROLS
     =======================================================*/
  function closeMenu() {
    emit('closeMenu');
    showCreateForm.value = false;
    isCreating.value = false;
    clothingStore.setIsCreating(false);
  }

  /* =========================================================
     UTILS
     =======================================================*/
  function getBrandLogo(brand: string) {
    const logos: Record<string, string> = {
      ['BELLA + CANVAS']: '/logos/bellacanvas.png',
      ['Gildan']: '/logos/gildan.png',
      ['Hanes']: '/logos/hanes.png',
      ['Tultex']: '/logos/tultex.png',
      ['H&M']: '/logos/handm.png',
      ['Nike']: '/logos/nike.jpg',
      ['Uniqlo']: '/logos/uniqlo.png',
      ['Gap']: '/logos/gap.png',
      ['J.Crew']: '/logos/jcrew.png',
    };
    return logos[brand] || '';
  }
</script>

<style scoped lang="scss">
  .slide-menu {
    position: fixed;
    top: 1;
    left: 1;
    right: 1;
    transform: translate(-180%, -17.5rem);
    width: 30rem;
    max-height: 100%;
    background-color: rgb(255, 255, 255);
    color: white;
    z-index: 1;
    border-bottom-right-radius: 20px;
    border-top-right-radius: 20px;
    display: flex;
    flex-direction: column;
  }

  .slide-menu-header {
    font-family: 'Anek Latin';
    align-items: center;
    display: flex;
    justify-content: space-between;
    background-color: rgb(107, 112, 120);
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
    margin: 1.5rem;
    color: #232323;
    font-family: 'Anek Latin';
    margin-top: 1rem;
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
      font-weight: 600
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
      border-bottom: 2px solid #94C940;
      height: 21px;
      color: inherit;
      text-decoration: none;
      display: inline-block;
      vertical-align: top;
    }

    p {
      margin: 0;
      font-size: large;
      font-weight: 500
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

  .upload-btn {
    background-color: #94C940;
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
    font-family: 'Gujarati Sangam MN';
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
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .product-color-button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.75rem;
    border: 1px solid transparent;
    background: #f8fafc;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .product-color-button.is-selected {
    border-color: #2563eb;
    background: #e0e7ff;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }

  .product-color-swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    border: 1px solid rgba(15, 23, 42, 0.15);
    background-size: cover;
    background-position: center;
  }

  .product-color-name {
    font-size: 0.85rem;
    color: #1f2937;
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
    border-top: 1px solid #19191934;
    height: 10rem;

    .variant-row {

      display: flex;
      justify-content: space-evenly;

      .component {
        display: flex;
        flex-direction: column;
        width: fit-content;

        span {
          justify-content: center;

        }



        .swatches {
          position: absolute;

        }
      }
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
    gap: .5rem;
    padding: .35rem .6rem;
    border: 1px solid #a0a6ac;
    background: #fff;
    border-radius: 8px;
    cursor: pointer;
    font-size: .85rem;
  }

  .current-swatch-btn .swatch-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-block;
  }

  .current-swatch-btn .caret {
    opacity: .6;
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
    box-shadow: -8px 0 24px rgba(0, 0, 0, .08);
    z-index: 1200;
    display: flex;
    flex-direction: column;
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: .75rem .9rem;
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
    padding: .75rem .9rem;
    overflow-y: auto;
  }

  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: .5rem;
  }

  .swatch-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: .5rem;
    padding: .4rem .5rem;
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
    background: rgba(0, 0, 0, .12);
    z-index: 1199;
  }

  .slide-left-enter-active,
  .slide-left-leave-active {
    transition: transform .16s ease, opacity .16s ease;
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
// Helper to generate a shape preview image using the new shape generator pipeline
