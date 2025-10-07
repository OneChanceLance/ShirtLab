<template>
  <SideMenu :active-menu="props.activeMenu"
    @request-menu="(menu: string, title: string) => emit('request-menu', menu, title)" />
  <CanvasArea>
    <div class="shirtlab-stage">
      <button v-if="!showClothingPicker" type="button" class="clothing-overlay__toggle" @click="openClothingPicker">
        Change Garment
      </button>
      <ShirtPlacer ref="shirtPlacerRef" />

    </div>
  </CanvasArea>
  <transition name="clothing-overlay-fade">
    <div v-if="showClothingPicker" class="clothing-overlay" role="dialog" aria-modal="true">
      <div class="clothing-overlay__panel">

        <div class="clothing-overlay__filters">
          <div class="search-bar" role="search">
            <span class="search-bar__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
              </svg>
            </span>
            <input v-model="clothingSearch" type="search" class="search-bar__input"
              placeholder="Search by name, brand, or code" />
            <button v-if="clothingSearch" type="button" class="search-bar__clear" aria-label="Clear search"
              @click="clothingSearch = ''">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="m12 10.586 4.95-4.95 1.414 1.414L13.414 12l4.95 4.95-1.414 1.414L12 13.414l-4.95 4.95-1.414-1.414L10.586 12 5.636 7.05 7.05 5.636 12 10.586z" />
              </svg>
            </button>
          </div>
          <div class="filter-dropdowns">
            <div class="filter-group">
              <label class="filter-label" for="category-filter">Category</label>
              <div class="filter-select__wrapper">
                <select id="category-filter" v-model="selectedCategory" class="filter-select">
                  <option v-for="option in categoryOptions" :key="option.id" :value="option.id">
                    {{ option.label }}
                  </option>
                </select>
                <span class="filter-select__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </span>
              </div>
            </div>
            <div v-if="subcategoryOptions.length > 1" class="filter-group">
              <label class="filter-label" for="subcategory-filter">Subcategory</label>
              <div class="filter-select__wrapper">
                <select id="subcategory-filter" v-model="selectedSubcategory" class="filter-select">
                  <option v-for="option in subcategoryOptions" :key="option.id" :value="option.id">
                    {{ option.label }}
                  </option>
                </select>
                <span class="filter-select__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

        </div>
        <div class="clothing-overlay__body">
          <div v-if="overlayLoading" class="status">Loading styles…</div>
          <div v-else-if="overlayError" class="status error">{{ overlayError }}</div>
          <div v-else-if="filteredClothing.length === 0" class="status">No styles match your filters.</div>
          <div v-else :class="['clothing-grid', { 'clothing-grid--pair': filteredClothing.length <= 2 }]">
            <button v-for="item in filteredClothing" :key="item.id" type="button"
              :class="['clothing-card', { selected: String(item.id ?? '') === activeItemId }]"
              @click="applyClothingItem(item)">
              <div class="clothing-card__preview">
                <img :src="resolvePreview(item) || overlayFallbackPreview" :alt="item.name || 'Garment preview'" />
              </div>
              <div class="clothing-card__meta">
                <h3>{{ item.name || 'Unnamed Style' }}</h3>
                <p>{{ formatClothingMeta(item) }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, nextTick, watchEffect, watch } from 'vue';
  import type { ImageObject, TextObject } from './types';
  import CanvasArea from '../canvasArea/CanvasArea.vue';
  import SideMenu from '../sideMenu/SideMenu.vue';
  import ShirtPlacer from './ShirtPlacer.vue';
  import { getClothesByAnyCode, getClothingItemById, getClothingItemByAnyCode } from './clothesDb';
  import { setProductColors, setSelectedProductColorIndex, setSelectedProductSize, selectedProductSize } from '../sideMenu/types/colorList';
  import { supabase } from '../../supabase';
  import type { ClothingItemRow } from './clothesDb';
  import { findMeasurementForSize, normalizeSizeLabel } from '../../utils/sizeMeasurements';
  import type { SizeMeasurementEntry, SizeMeasurementSpec } from '../../utils/sizeMeasurements';

  const props = defineProps<{ activeMenu?: string | null }>();
  const emit = defineEmits<{ (e: 'request-menu', menu: string, title: string): void; }>();

  const DEBUG = false; // flip to false in prod

  const CATEGORY_ALL = '__all__';
  const SUBCATEGORY_ALL = '__all__';
  const UNCATEGORIZED_LABEL = 'Uncategorized';
  const UNSPECIFIED_SUBCATEGORY_LABEL = 'Miscellaneous';
  const overlayFallbackPreview = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

  const showClothingPicker = ref(true);
  const clothingItems = ref<ClothingItemRow[]>([]);
  const clothingLoading = ref(true);
  const clothingError = ref('');
  const clothingSearch = ref('');
  const selectedCategory = ref<string>(CATEGORY_ALL);
  const selectedSubcategory = ref<string>(SUBCATEGORY_ALL);
  const activeItemId = ref<string | null>(null);
  const categories = ref<any[]>([]);
  const subcategories = ref<any[]>([]);
  const categoriesLoading = ref(false);
  const subcategoriesLoading = ref(false);
  const categoryError = ref('');
  const subcategoryError = ref('');
  const currentSizeMeasurements = ref<SizeMeasurementEntry[]>([]);

  const shirtPlacerRef = ref();

  const overlayLoading = computed(() => clothingLoading.value || categoriesLoading.value || subcategoriesLoading.value);
  const overlayError = computed(() => clothingError.value || categoryError.value || subcategoryError.value);

  function toNumber(value: any, fallback?: number) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function asObject(value: any): Record<string, any> | null {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return (parsed && typeof parsed === 'object') ? parsed : null;
      } catch {
        return null;
      }
    }
    if (typeof value === 'object') return value as Record<string, any>;
    return null;
  }

  function asArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function normalizeColors(value: any): any[] {
    return asArray(value).filter((entry) => entry && typeof entry === 'object');
  }

  const INCH_UNITS = new Set(['in', 'inch', 'inches']);
  const CM_UNITS = new Set(['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres']);
  const MM_UNITS = new Set(['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres']);
  const M_UNITS = new Set(['m', 'meter', 'meters', 'metre', 'metres']);

  function convertMeasurementToInches(value: number, unit?: string | null): number | null {
    if (!Number.isFinite(value)) return null;
    if (!unit) return value;
    const normalized = unit.trim().toLowerCase();
    if (INCH_UNITS.has(normalized)) return value;
    if (CM_UNITS.has(normalized)) return value / 2.54;
    if (MM_UNITS.has(normalized)) return value / 25.4;
    if (M_UNITS.has(normalized)) return value * 39.3701;
    return null;
  }

  function normalizeSizeMeasurements(value: any): SizeMeasurementEntry[] {
    const source = Array.isArray(value) ? value : asArray(value);
    const normalized: SizeMeasurementEntry[] = [];

    for (const entry of source) {
      const rawLabel = typeof entry?.sizeLabel === 'string'
        ? entry.sizeLabel
        : typeof entry?.label === 'string'
          ? entry.label
          : typeof entry?.size === 'string'
            ? entry.size
            : '';
      const sizeLabel = rawLabel.trim();
      if (!sizeLabel) continue;

      const explicitNormalized = typeof entry?.normalizedLabel === 'string' && entry.normalizedLabel.trim()
        ? normalizeSizeLabel(entry.normalizedLabel)
        : normalizeSizeLabel(sizeLabel);

      const specsArray = Array.isArray(entry?.specs) ? entry.specs : [];
      const specs: SizeMeasurementSpec[] = [];

      for (const spec of specsArray) {
        const rawKey = typeof spec?.key === 'string' && spec.key.trim()
          ? spec.key.trim()
          : typeof spec?.type === 'string'
            ? spec.type.trim()
            : '';
        const key = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (!key) continue;

        const type = typeof spec?.type === 'string' && spec.type.trim() ? spec.type.trim() : rawKey || key;
        const unit = typeof spec?.unit === 'string' && spec.unit.trim() ? spec.unit.trim() : 'inches';
        const value = Number(spec?.value ?? spec?.measurementValue);
        if (!Number.isFinite(value)) continue;
        const rawValueInInches = Number((spec as any)?.valueInInches ?? (spec as any)?.value_in_inches);
        const valueInInches = Number.isFinite(rawValueInInches)
          ? rawValueInInches
          : convertMeasurementToInches(value, unit);

        specs.push({
          key,
          type,
          unit,
          value,
          valueInInches: valueInInches ?? null,
        });
      }

      if (!specs.length) continue;

      normalized.push({
        sizeLabel,
        normalizedLabel: explicitNormalized,
        specs,
      });
    }

    return normalized;
  }

  function isSizeSupported(
    size: string | null | undefined,
    measurementEntries: SizeMeasurementEntry[],
    colorSizes: string[],
  ): boolean {
    if (!size) return false;
    const trimmed = size.trim();
    if (!trimmed) return false;
    if (colorSizes.some((candidate) => candidate === trimmed)) return true;
    const measurement = findMeasurementForSize(measurementEntries, trimmed);
    return Boolean(measurement);
  }

  function extractCategoryId(entry: any): string {
    const candidate = entry?.id ?? entry?.code ?? entry?.slug ?? entry?.value ?? entry?.key ?? null;
    return candidate !== null && candidate !== undefined ? String(candidate) : '';
  }

  function extractCategoryLabel(entry: any): string {
    const label = entry?.name ?? entry?.label ?? entry?.title ?? entry?.category ?? entry?.displayName;
    if (typeof label === 'string' && label.trim()) return label.trim();
    return UNCATEGORIZED_LABEL;
  }

  function extractSubcategoryId(entry: any): string {
    const candidate = entry?.id ?? entry?.code ?? entry?.slug ?? entry?.value ?? entry?.key ?? null;
    return candidate !== null && candidate !== undefined ? String(candidate) : '';
  }

  function extractSubcategoryLabel(entry: any): string {
    const label = entry?.name ?? entry?.label ?? entry?.title ?? entry?.displayName;
    if (typeof label === 'string' && label.trim()) return label.trim();
    return UNSPECIFIED_SUBCATEGORY_LABEL;
  }

  function extractSubcategoryCategoryId(entry: any): string {
    const candidate = entry?.category_id ?? entry?.categoryId ?? entry?.category ?? entry?.category_code ?? entry?.categoryCode;
    return candidate !== null && candidate !== undefined ? String(candidate) : '';
  }

  function itemCategoryId(item: ClothingItemRow): string {
    const candidate = (item as any)?.category ?? (item as any)?.category_id ?? (item as any)?.categoryId ?? (item as any)?.category_code;
    return candidate !== null && candidate !== undefined ? String(candidate) : '';
  }

  function itemSubcategoryId(item: ClothingItemRow): string {
    const candidate = (item as any)?.subcategory ?? (item as any)?.subcategory_id ?? (item as any)?.subcategoryId
      ?? (item as any)?.subcategory_code ?? (item as any)?.sub_category;
    return candidate !== null && candidate !== undefined ? String(candidate) : '';
  }

  function resolveColorImage(color: Record<string, any> | undefined, side: 'front' | 'back') {
    if (!color || typeof color !== 'object') return null;
    const keys = side === 'front'
      ? ['frontUrl', 'frontURL', 'frontImage', 'front', 'imageUrl', 'url']
      : ['backUrl', 'backURL', 'backImage', 'back', 'imageUrl'];
    for (const key of keys) {
      const value = color[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  }

  function resolvePreview(item: ClothingItemRow): string | null {
    const colors = normalizeColors((item as any)?.colors);
    const defaultColorId = (item as any)?.default_color_id ?? (item as any)?.defaultColorId ?? (item as any)?.defaultColorID ?? null;
    let choice = colors.find((entry: any) => entry?.id === defaultColorId);
    if (!choice) choice = colors[0];
    const backgrounds = asObject((item as any)?.backgrounds) ?? {};
    const front = resolveColorImage(choice, 'front');
    if (front) return front;
    const back = resolveColorImage(choice, 'back');
    if (back) return back;
    if (typeof backgrounds.front === 'string' && backgrounds.front.trim()) return backgrounds.front;
    if (typeof backgrounds.back === 'string' && backgrounds.back.trim()) return backgrounds.back;
    const fallbacks = [(item as any)?.frontUrl, (item as any)?.frontImage, (item as any)?.imageUrl];
    for (const candidate of fallbacks) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    return null;
  }

  const categoryMap = computed(() => {
    const map = new Map<string, string>();
    for (const entry of categories.value) {
      const id = extractCategoryId(entry);
      if (!id) continue;
      map.set(id, extractCategoryLabel(entry));
    }
    return map;
  });

  const subcategoryMap = computed(() => {
    const map = new Map<string, { label: string; categoryId: string }>();
    for (const entry of subcategories.value) {
      const id = extractSubcategoryId(entry);
      if (!id) continue;
      map.set(id, {
        label: extractSubcategoryLabel(entry),
        categoryId: extractSubcategoryCategoryId(entry),
      });
    }
    return map;
  });

  function formatClothingMeta(item: ClothingItemRow): string {
    const parts: string[] = [];
    const brand = (item as any)?.brand;
    if (typeof brand === 'string' && brand.trim()) parts.push(brand.trim());
    const code = (item as any)?.code ?? (item as any)?.sku;
    if (typeof code === 'string' && code.trim()) parts.push(code.trim());
    const categoryId = itemCategoryId(item);
    const categoryLabel = categoryMap.value.get(categoryId);
    if (categoryLabel && categoryLabel !== UNCATEGORIZED_LABEL) parts.push(categoryLabel);
    const subcategoryId = itemSubcategoryId(item);
    const subEntry = subcategoryMap.value.get(subcategoryId);
    if (subEntry && subEntry.label && subEntry.label !== UNSPECIFIED_SUBCATEGORY_LABEL) parts.push(subEntry.label);
    return parts.join(' · ') || '—';
  }

  const categoryOptions = computed(() => {
    const entries: Array<{ id: string; label: string }> = [];
    categoryMap.value.forEach((label, id) => {
      entries.push({ id, label });
    });
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return [
      { id: CATEGORY_ALL, label: 'All categories' },
      ...entries,
    ];
  });

  const subcategoryOptions = computed(() => {
    const entries: Array<{ id: string; label: string }> = [];
    subcategoryMap.value.forEach(({ label, categoryId }, id) => {
      if (
        selectedCategory.value !== CATEGORY_ALL &&
        categoryId && categoryId !== selectedCategory.value
      ) {
        return;
      }
      entries.push({ id, label });
    });
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return [
      { id: SUBCATEGORY_ALL, label: 'All subcategories' },
      ...entries,
    ];
  });

  const filteredClothing = computed(() => {
    const query = clothingSearch.value.trim().toLowerCase();
    return clothingItems.value.filter((item) => {
      const itemCat = itemCategoryId(item);
      if (selectedCategory.value !== CATEGORY_ALL) {
        if (!itemCat || itemCat !== selectedCategory.value) return false;
      }

      const itemSub = itemSubcategoryId(item);
      if (selectedSubcategory.value !== SUBCATEGORY_ALL) {
        if (!itemSub || itemSub !== selectedSubcategory.value) return false;
      }

      if (!query) return true;
      const haystack: string[] = [];
      const baseFields = [item.name, (item as any)?.brand, (item as any)?.code, (item as any)?.sku];
      for (const field of baseFields) {
        if (typeof field === 'string' && field.trim()) haystack.push(field.trim().toLowerCase());
      }
      const categoryLabel = categoryMap.value.get(itemCat);
      if (categoryLabel && categoryLabel.trim()) haystack.push(categoryLabel.trim().toLowerCase());
      const subEntry = subcategoryMap.value.get(itemSub);
      if (subEntry && subEntry.label && subEntry.label.trim()) {
        haystack.push(subEntry.label.trim().toLowerCase());
      }
      const colors = normalizeColors((item as any)?.colors);
      for (const color of colors) {
        const colorName = typeof color?.name === 'string' ? color.name : typeof color?.label === 'string' ? color.label : '';
        if (colorName && colorName.trim()) haystack.push(colorName.trim().toLowerCase());
      }
      return haystack.some((entry) => entry.includes(query));
    });
  });

  watch(selectedCategory, () => {
    selectedSubcategory.value = SUBCATEGORY_ALL;
  });

  watch(categoryOptions, (options) => {
    if (selectedCategory.value === CATEGORY_ALL) return;
    const hasSelection = options.some((option) => option.id === selectedCategory.value);
    if (!hasSelection) selectedCategory.value = CATEGORY_ALL;
  });

  watch(subcategoryOptions, (options) => {
    if (selectedSubcategory.value === SUBCATEGORY_ALL) return;
    const hasSelection = options.some((option) => option.id === selectedSubcategory.value);
    if (!hasSelection) selectedSubcategory.value = SUBCATEGORY_ALL;
  });

  watch(selectedProductSize, (size) => {
    const update: Record<string, any> = { size: size ?? null };
    update.sizeMeasurements = currentSizeMeasurements.value;
    shirtPlacerRef.value?.updateClothing(update);
  });

  function openClothingPicker() {
    showClothingPicker.value = true;
    loadClothingItems();
    loadCategories();
    loadSubcategories();
  }

  async function loadClothingItems() {
    clothingLoading.value = true;
    clothingError.value = '';
    try {
      const { data, error } = await supabase
        .from('clothing_items')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      clothingItems.value = Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.error('[ShirtLab] Failed to load clothing items', err);
      if (err?.code === '42P01') {
        clothingError.value = 'Supabase table `clothing_items` is missing. Import styles in the admin dashboard to populate this list.';
      } else {
        clothingError.value = err?.message || 'Unable to load clothing items.';
      }
      clothingItems.value = [];
    } finally {
      clothingLoading.value = false;
    }
  }

  async function loadCategories() {
    categoriesLoading.value = true;
    categoryError.value = '';
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*');

      if (error) throw error;
      categories.value = Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.error('[ShirtLab] Failed to load categories', err);
      if (err?.code === '42P01') {
        categoryError.value = 'Supabase table `categories` is missing. Create categories to enable garment filtering.';
      } else {
        categoryError.value = err?.message || 'Unable to load categories.';
      }
      categories.value = [];
    } finally {
      categoriesLoading.value = false;
    }
  }

  async function loadSubcategories() {
    subcategoriesLoading.value = true;
    subcategoryError.value = '';
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*');

      if (error) throw error;
      subcategories.value = Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.error('[ShirtLab] Failed to load subcategories', err);
      if (err?.code === '42P01') {
        subcategoryError.value = 'Supabase table `subcategories` is missing. Create subcategories to enable garment filtering.';
      } else {
        subcategoryError.value = err?.message || 'Unable to load subcategories.';
      }
      subcategories.value = [];
    } finally {
      subcategoriesLoading.value = false;
    }
  }

  function startBlank() {
    setProductColors([]);
    setSelectedProductColorIndex(0);
    activeItemId.value = null;
    showClothingPicker.value = false;
    (shirtPlacerRef.value as any)?.clearClothing?.();
  }

  function applyClothingItem(item: ClothingItemRow) {
    const colors = normalizeColors((item as any)?.colors);
    setProductColors(colors);
    const defaultColorId = (item as any)?.default_color_id ?? (item as any)?.defaultColorId ?? (item as any)?.defaultColorID ?? null;
    let selectedIndex = colors.findIndex((color: any) => color?.id === defaultColorId);
    if (selectedIndex < 0) selectedIndex = colors.length ? 0 : -1;
    setSelectedProductColorIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const chosenColor = selectedIndex >= 0 ? colors[selectedIndex] : {};

    const sizeMeasurements = normalizeSizeMeasurements((item as any)?.size_measurements ?? (item as any)?.sizeMeasurements);
    currentSizeMeasurements.value = sizeMeasurements;

    const colorSizeList = Array.isArray((chosenColor as any)?.sizes)
      ? (chosenColor as any).sizes
        .map((size: any) => typeof size === 'string' ? size.trim() : typeof size === 'number' ? String(size) : '')
        .filter((entry: string) => Boolean(entry))
      : [];

    let initialSize = selectedProductSize.value;
    if (!isSizeSupported(initialSize ?? null, sizeMeasurements, colorSizeList)) {
      initialSize = colorSizeList[0]
        ?? (sizeMeasurements.length ? sizeMeasurements[0].sizeLabel : null);
    }
    if (initialSize) {
      setSelectedProductSize(initialSize);
    } else {
      setSelectedProductSize(null);
    }

    const gridSource = asObject((item as any)?.grid) ?? {};
    const grid = {
      x: toNumber((gridSource as any).x, 175),
      y: toNumber((gridSource as any).y, 150),
      w: toNumber((gridSource as any).w, 250),
      h: toNumber((gridSource as any).h, 400),
      widthInches: toNumber((gridSource as any).widthInches ?? (gridSource as any).physicalWidth ?? (gridSource as any).widthIn ?? (gridSource as any).width_in),
      heightInches: toNumber((gridSource as any).heightInches ?? (gridSource as any).physicalHeight ?? (gridSource as any).heightIn ?? (gridSource as any).height_in),
      dpi: toNumber((gridSource as any).dpi ?? (gridSource as any).pxPerInch ?? (gridSource as any).pixelsPerInch ?? (gridSource as any).ppi),
      auto: (gridSource as any).auto ?? (gridSource as any).autoGenerated ?? null,
      autoGenerated: (gridSource as any).autoGenerated ?? (gridSource as any).auto ?? null,
    };

    const backgrounds = asObject((item as any)?.backgrounds) ?? {};
    const previewImage = resolvePreview(item) ?? undefined;
    const front = resolveColorImage(chosenColor, 'front')
      || (typeof backgrounds.front === 'string' && backgrounds.front.trim() ? backgrounds.front : undefined)
      || previewImage;
    const backCandidate = resolveColorImage(chosenColor, 'back');
    const back = backCandidate
      || (typeof backgrounds.back === 'string' && backgrounds.back.trim() ? backgrounds.back : undefined)
      || previewImage
      || front;

    const payload: Record<string, any> = {
      name: item.name,
      grid,
      colors,
      front,
      back,
    };

    payload.sizeMeasurements = sizeMeasurements;
    payload.size = initialSize ?? selectedProductSize.value ?? null;

    const transform = asObject((chosenColor as any)?.bgTransform)
      || asObject((gridSource as any)?.bgTransform)
      || asObject((item as any)?.bgTransform);
    if (transform) {
      payload.bgTransform = {
        offsetX: toNumber(transform.offsetX, 0),
        offsetY: toNumber(transform.offsetY, 0),
        scale: toNumber(transform.scale, 1),
      };
    }

    shirtPlacerRef.value?.updateClothing(payload);
    const itemId = (item as any)?.id;
    activeItemId.value = itemId !== undefined && itemId !== null ? String(itemId) : null;
    showClothingPicker.value = false;
  }

  // Only accept messages from these origins
  const ALLOWED_ORIGINS = new Set<string>([
    'https://seeourdesigns.com',
    'https://www.seeourdesigns.com',
    'http://localhost:5173', // dev vite
    'http://127.0.0.1:5173',
  ]);

  function logAllColumns(label: string, obj: any) {
    try {
      const entries = Object.entries(obj || {});
      console.group(label);
      console.log('raw:', obj);
      console.log('column names:', entries.map(([k]) => k));
      const table: Record<string, any> = {};
      for (const [k, v] of entries) table[k] = v;
      console.table(table);
      // also print key-by-key to make it obvious in collapsed logs
      for (const [k, v] of entries) console.log(`${k}:`, v);
      console.groupEnd();
    } catch (err) {
      console.warn('[ShirtLab] logAllColumns failed', err);
    }
  }

  async function handleExternalMessage(ev: MessageEvent) {
    // Security: require known host origin
    if (!ALLOWED_ORIGINS.has(ev.origin)) return;

    const msg = ev.data as any;
    if (DEBUG) console.log('[ShirtLab] message from', ev.origin, msg);
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

    let ok = false;
    try {
      switch (msg.type) {
        case 'shirtlab:set-clothing': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.updateClothing({
            front: p.front,
            back: p.back,
            grid: p.grid,
            bgTransform: p.bgTransform,
          });
          ok = true;
          break;
        }
        case 'shirtlab:set-images': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.setClothingImages({
            front: p.front,
            back: p.back,
          });
          ok = true;
          break;
        }
        case 'shirtlab:set-grid': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.updateClothing({ grid: p });
          ok = true;
          break;
        }
        case 'shirtlab:set-bg': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.setBackgroundTransform({
            offsetX: p.offsetX,
            offsetY: p.offsetY,
            scale: p.scale,
          });
          ok = true;
          break;
        }
        case 'shirtlab:load-product': {
          const p = msg.payload || {};
          ok = await loadProductByCode(String(p.code || ''), Number(p.colorIndex ?? 0));
          break;
        }
      }
    } finally {
      // Send ACK back to the sender (if same-window messaging is supported)
      try {
        const id = msg && typeof msg === 'object' ? msg.id : undefined;
        (ev.source as WindowProxy | null)?.postMessage({
          type: 'shirtlab:ack',
          id,
          ok,
        }, ev.origin);
      } catch { }
    }
  }


  async function loadProductByCode(code: string, colorIndex: number = 0) {
    if (!code) return false;

    // 1) Try clothing_items by code first; if the code happens to be a UUID, also try by id
    try {
      let item = await getClothingItemByAnyCode(code);
      if (!item && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code)) {
        item = await getClothingItemById(code);
      }
      if (item) {
        // Debug: print all columns returned from clothing_items
        logAllColumns(`[ShirtLab] clothing_items row for code ${code}`, item);

        const gridJson: any = item.grid || {};
        const parseNum = (value: any, fallback?: number) => {
          const n = Number(value);
          return Number.isFinite(n) ? n : fallback;
        };
        const grid = {
          x: parseNum(gridJson.x, 175),
          y: parseNum(gridJson.y, 150),
          w: parseNum(gridJson.w, 250),
          h: parseNum(gridJson.h, 400),
          widthInches: parseNum(gridJson.widthInches ?? gridJson.physicalWidth ?? gridJson.widthIn ?? gridJson.width_in),
          heightInches: parseNum(gridJson.heightInches ?? gridJson.physicalHeight ?? gridJson.heightIn ?? gridJson.height_in),
          dpi: parseNum(gridJson.dpi ?? gridJson.pxPerInch ?? gridJson.pixelsPerInch ?? gridJson.ppi),
          auto: gridJson.auto ?? gridJson.autoGenerated ?? null,
          autoGenerated: gridJson.autoGenerated ?? gridJson.auto ?? null,
        };

        const colorsArr: any[] = Array.isArray(item.colors) ? item.colors : [];
        let selectedIdx = Number.isInteger(colorIndex) ? colorIndex : 0;
        if (colorsArr.length) {
          const defaultColorIdItem = (item as any).default_color_id ?? (item as any).defaultColorId ?? (item as any).defaultColorID ?? null;
          if (!(selectedIdx >= 0 && selectedIdx < colorsArr.length)) {
            selectedIdx = defaultColorIdItem ? colorsArr.findIndex(color => color?.id === defaultColorIdItem) : 0;
          }
          if (selectedIdx < 0 || selectedIdx >= colorsArr.length) selectedIdx = 0;
          setProductColors(colorsArr);
          setSelectedProductColorIndex(selectedIdx);
        } else {
          setProductColors([]);
          setSelectedProductColorIndex(0);
        }
        const c = colorsArr[selectedIdx] ?? colorsArr[0] ?? {};
        const sizeMeasurements = normalizeSizeMeasurements((item as any)?.size_measurements ?? (item as any)?.sizeMeasurements);
        currentSizeMeasurements.value = sizeMeasurements;
        const colorSizeList = Array.isArray(c?.sizes)
          ? c.sizes
            .map((size: any) => typeof size === 'string' ? size.trim() : typeof size === 'number' ? String(size) : '')
            .filter((entry: string) => Boolean(entry))
          : [];
        let initialSize = selectedProductSize.value;
        if (!isSizeSupported(initialSize ?? null, sizeMeasurements, colorSizeList)) {
          initialSize = colorSizeList[0] ?? (sizeMeasurements.length ? sizeMeasurements[0].sizeLabel : null);
        }
        setSelectedProductSize(initialSize ?? null);

        const front: string | undefined =
          c.frontUrl || c.frontURL || c.frontImage || c.front || c.imageUrl || undefined;
        const back: string | undefined =
          c.backUrl || c.backURL || c.backImage || c.back || c.imageUrl || undefined;

        const bgs: any = (item as any).backgrounds || {};
        const rootFront = (item as any).frontUrl || (item as any).frontImage || (item as any).imageUrl;
        const rootBack = (item as any).backUrl || (item as any).backImage || (item as any).imageUrl;
        const useFront = front ?? bgs.front ?? rootFront;
        const useBack = back ?? bgs.back ?? rootBack;

        const bgT: any = c.bgTransform || gridJson.bgTransform || {};
        const bgTransform = {
          offsetX: Number(bgT.offsetX ?? 0),
          offsetY: Number(bgT.offsetY ?? 0),
          scale: Number(bgT.scale ?? 1),
        };

        shirtPlacerRef.value?.updateClothing({
          front: useFront,
          back: useBack,
          grid,
          bgTransform,
          size: initialSize ?? null,
          sizeMeasurements,
        });
        showClothingPicker.value = false;
        activeItemId.value = item.id !== undefined && item.id !== null ? String(item.id) : null;
        return true;
      }
    } catch (e) {
      console.warn('[ShirtLab] clothing_items lookup failed (code/id), trying legacy code table', e);
    }

    // 2) Legacy fallback: code-based rows in `clothes`
    try {
      const row = await getClothesByAnyCode(code);
      if (!row) {
        console.info('[ShirtLab] Legacy `clothes` table not present or no row found for code', code);
        return false;
      }

      // Debug: print all columns returned from legacy `clothing`/`clothes`
      logAllColumns(`[ShirtLab] legacy clothing row for code ${code}`, row);

      const baseFront = row.front_url ?? row.image_front ?? undefined;
      const baseBack = row.back_url ?? row.image_back ?? undefined;
      const legacyParse = (value: any, fallback?: number) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
      };
      const grid = {
        x: legacyParse(row.grid_x ?? row.print_x, 0),
        y: legacyParse(row.grid_y ?? row.print_y, 0),
        w: legacyParse(row.grid_w ?? row.print_w, 300),
        h: legacyParse(row.grid_h ?? row.print_h, 400),
        widthInches: legacyParse(row.grid_width_inches ?? row.grid_width_in ?? row.print_width_in ?? row.print_width_inches),
        heightInches: legacyParse(row.grid_height_inches ?? row.grid_height_in ?? row.print_height_in ?? row.print_height_inches),
        dpi: legacyParse(row.grid_dpi ?? row.print_dpi ?? row.grid_ppi ?? row.print_ppi),
        auto: null,
        autoGenerated: null,
      };
      const colorsArr = Array.isArray((row as any).colors) ? (row as any).colors : [];
      let selectedIdx = Number.isInteger(colorIndex) ? colorIndex : 0;
      if (colorsArr.length) {
        const defaultColorIdRow = (row as any).default_color_id ?? (row as any).defaultColorId ?? (row as any).defaultColorID ?? null;
        if (!(selectedIdx >= 0 && selectedIdx < colorsArr.length)) {
          selectedIdx = defaultColorIdRow ? colorsArr.findIndex((color: any) => color?.id === defaultColorIdRow) : 0;
        }
        if (selectedIdx < 0 || selectedIdx >= colorsArr.length) selectedIdx = 0;
        setProductColors(colorsArr);
        setSelectedProductColorIndex(selectedIdx);
      } else {
        setProductColors([]);
        setSelectedProductColorIndex(0);
      }
      const selectedColor = colorsArr[selectedIdx] ?? colorsArr[0] ?? {};
      currentSizeMeasurements.value = [];
      const legacySizes = Array.isArray(selectedColor?.sizes)
        ? selectedColor.sizes
          .map((size: any) => typeof size === 'string' ? size.trim() : typeof size === 'number' ? String(size) : '')
          .filter((entry: string) => Boolean(entry))
        : [];
      const legacyInitialSize = legacySizes[0] ?? null;
      setSelectedProductSize(legacyInitialSize);
      const useFront = selectedColor?.frontUrl || selectedColor?.front || baseFront;
      const useBack = selectedColor?.backUrl || selectedColor?.back || baseBack || useFront;
      const colorBgTransform = selectedColor?.bgTransform;
      const bgTransform = colorBgTransform
        ? {
          offsetX: Number(colorBgTransform.offsetX ?? 0),
          offsetY: Number(colorBgTransform.offsetY ?? 0),
          scale: Number(colorBgTransform.scale ?? 1),
        }
        : {
          offsetX: Number(row.bg_offset_x ?? row.bgX ?? 0),
          offsetY: Number(row.bg_offset_y ?? row.bgY ?? 0),
          scale: Number(row.bg_scale ?? row.bgScale ?? 1),
        };
      shirtPlacerRef.value?.updateClothing({
        front: useFront,
        back: useBack,
        grid,
        bgTransform,
        size: legacyInitialSize,
        sizeMeasurements: [],
      });
      showClothingPicker.value = false;
      activeItemId.value = row?.id ? String(row.id) : null;
      return true;
    } catch (err: any) {
      if (err && err.code === '42P01') {
        console.info('[ShirtLab] Legacy `clothes` table missing; skipping fallback');
        return false;
      }
      console.error('[ShirtLab] loadProductByCode failed', err);
      setProductColors([]);
      setSelectedProductColorIndex(0);
      return false;
    }
  }

  function applyExternalClothing(payload: {
    front?: string;
    back?: string;
    grid?: any;
    colors?: any[];
    bgTransform?: any;
    size?: string | null;
    sizeMeasurements?: any;
  }) {
    if (!payload) return;

    const details: any = {};
    if (payload.grid) details.grid = payload.grid;
    if (payload.colors) details.colors = payload.colors;
    if (payload.front) details.front = payload.front;
    if (payload.back) details.back = payload.back;
    const transform = payload.bgTransform ?? payload.colors?.[0]?.bgTransform;
    if (transform) details.bgTransform = transform;

    if (Object.prototype.hasOwnProperty.call(payload, 'sizeMeasurements')) {
      const normalizedMeasurements = normalizeSizeMeasurements(payload.sizeMeasurements);
      currentSizeMeasurements.value = normalizedMeasurements;
      details.sizeMeasurements = normalizedMeasurements;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'size')) {
      const nextSize = typeof payload.size === 'string' ? payload.size : null;
      details.size = nextSize;
      setSelectedProductSize(nextSize);
    }

    shirtPlacerRef.value?.updateClothing(details);
    showClothingPicker.value = false;
    activeItemId.value = null;
  }

  onMounted(async () => {
    await Promise.all([
      loadClothingItems(),
      loadCategories(),
      loadSubcategories(),
    ]);

    window.addEventListener('message', handleExternalMessage);
    // Optional direct API for same-origin host pages
    (window as any).ShirtLab = {
      setClothing: (details: { front?: string; back?: string; grid?: { x: number; y: number; w: number; h: number }; bgTransform?: { offsetX?: number; offsetY?: number; scale?: number } }) =>
        shirtPlacerRef.value?.updateClothing(details),
      setImages: (imgs: { front?: string; back?: string }) =>
        shirtPlacerRef.value?.setClothingImages(imgs),
      setGrid: (grid: { x: number; y: number; w: number; h: number }) =>
        shirtPlacerRef.value?.updateClothing({ grid }),
      setBg: (t: { offsetX?: number; offsetY?: number; scale?: number }) =>
        shirtPlacerRef.value?.setBackgroundTransform(t),
      loadProduct: (code: string, colorIndex: number = 0) => loadProductByCode(code, colorIndex),
    };

    await nextTick();
    // Notify parent that widget is ready (for postMessage handshakes)
    try {
      window.parent?.postMessage({ type: 'shirtlab:ready' }, '*');
    } catch { }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleExternalMessage);
    if ((window as any).ShirtLab) delete (window as any).ShirtLab;
  });

  const selectedObject = computed<TextObject | ImageObject | null>(() => {
    return (shirtPlacerRef.value as any)?.selectedObject ?? null;
  });

  watchEffect(() => {
    const placer = shirtPlacerRef.value as any;
    console.log('[ShirtLab/watchEffect] raw ref ->', placer?.selectedObject);
    console.log('[ShirtLab/watchEffect] selectedObject ->', selectedObject.value);
  });

  watch(
    () => (shirtPlacerRef.value as any)?.selectedObject?.value,
    (val) => {
      console.log('[ShirtLab/watch] selectedObject ->', val);
    },
    { immediate: true }
  );

  function draw() {
    shirtPlacerRef.value?.draw();
  }

  function centerSelectedText() {
    shirtPlacerRef.value?.centerSelectedText();
  }

  function duplicateSelectedText() {
    shirtPlacerRef.value?.duplicateSelectedText?.();
  }

  function bringSelectedForward() {
    shirtPlacerRef.value?.bringSelectedForward?.();
  }

  function sendSelectedBack() {
    shirtPlacerRef.value?.sendSelectedBack?.();
  }
  function setClothingImages(imgs: { front?: string; back?: string }) {
    shirtPlacerRef.value?.setClothingImages(imgs);
  }

  function setBackgroundTransform(t: { offsetX?: number; offsetY?: number; scale?: number }) {
    shirtPlacerRef.value?.setBackgroundTransform(t);
  }

  function updateClothing(details: any) {
    shirtPlacerRef.value?.updateClothing(details);
  }

  function uploadObject(type: string, payload: any) {
    shirtPlacerRef.value?.uploadObject(type, payload);
  }

  defineExpose({
    loadProductByCode,
    applyExternalClothing,
    selectedObject,
    draw,
    centerSelectedText,
    duplicateSelectedText,
    bringSelectedForward,
    sendSelectedBack,
    setClothingImages,
    setBackgroundTransform,
    updateClothing,
    uploadObject,
  });
</script>

<style scoped lang="scss">
  .shirtlab-stage {
    position: relative;
    height: 100%;
  }

  .clothing-overlay__toggle {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 5;
    padding: 0.5rem 1.25rem;
    border-radius: 9999px;
    border: none;
    background: rgba(15, 23, 42, 0.85);
    color: #fff;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.3);
    }
  }

  .clothing-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;

    background: rgba(15, 23, 42, 0.55);
    z-index: 5000;
  }

  .clothing-overlay__panel {
    background: #fff;
    border-radius: 1rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 2rem;
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.28);
    max-height: 100%;
    overflow: hidden;
  }

  .clothing-overlay__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;

    h2 {
      margin: 0;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    p {
      margin: 0.25rem 0 0;
      color: #4b5563;
      font-size: 0.95rem;
    }
  }

  .clothing-overlay__header-actions {
    display: flex;
    gap: 0.75rem;

    .ghost {
      border-radius: 9999px;
      border: 1px solid rgba(15, 23, 42, 0.15);
      background: transparent;
      padding: 0.45rem 1.1rem;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover {
        background: rgba(15, 23, 42, 0.04);
      }
    }
  }

  .clothing-overlay__filters {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    box-sizing: border-box;
    padding: 0.7rem 1.1rem;
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.85));
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

    &:focus-within {
      border-color: rgba(14, 165, 233, 0.65);
      box-shadow: 0 22px 45px rgba(14, 116, 144, 0.18);
      background: linear-gradient(135deg, rgba(236, 254, 255, 0.95), rgba(224, 242, 254, 0.88));
    }
  }

  @supports (backdrop-filter: blur(8px)) {
    .search-bar {
      backdrop-filter: blur(8px);
      background: rgba(248, 250, 252, 0.7);

      &:focus-within {
        background: rgba(224, 242, 254, 0.9);
      }
    }
  }

  .search-bar__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 0.25rem;
  }

  .search-bar__icon svg,
  .search-bar__clear svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: #64748b;
  }

  .search-bar__input {
    flex: 1;
    border: none;

    background: transparent;
    font-size: 0.95rem;
    color: #0f172a;

    &::placeholder {
      color: #94a3b8;
    }

    &:focus {
      outline: none;
    }
  }

  .search-bar__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: rgba(148, 163, 184, 0.16);
    border-radius: 50%;
    width: 1.8rem;
    height: 1.8rem;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;

    &:hover {
      background: rgba(14, 165, 233, 0.2);
      transform: scale(1.04);
    }

    &:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.35);
    }
  }

  .filter-dropdowns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 1rem;
    padding: 0.75rem 0.9rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(241, 245, 249, 0.75);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 12px 25px rgba(15, 23, 42, 0.08);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .filter-label {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .filter-select__wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(226, 232, 240, 0.8));
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 0.9rem;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:focus-within {
      border-color: #94c9408c;
      box-shadow: 0 18px 32px rgba(90, 144, 14, 0.2);
    }
  }

  .filter-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: transparent;
    border: none;
    padding: 0.65rem 2.5rem 0.65rem 1rem;
    width: 100%;
    font-size: 0.95rem;
    color: #0f172a;
    cursor: pointer;

    &:focus {
      outline: none;
    }

    option {
      color: #0f172a;
      background: #f1f5f9;
    }
  }

  .filter-select__icon {
    position: absolute;
    right: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;

    svg {
      width: 1.1rem;
      height: 1.1rem;
      fill: #475569;
    }
  }

  @media (max-width: 720px) {
    .filter-dropdowns {
      grid-template-columns: 1fr;
    }
  }

  .clothing-overlay__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .status {
    margin: auto;
    font-size: 1rem;
    color: #475569;

    &.error {
      color: #b91c1c;
    }
  }

  .clothing-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    overflow-y: auto;
    padding-right: 0.25rem;
    padding-top: 0.25rem;
  }

  .clothing-grid--pair {
    /* Keep cards next to each other when there are only two */
    display: flex;

    /* center the two tracks, avoiding one on each edge */
  }

  .clothing-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    width: minmax(200px, 1fr);

    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: #f8fafc;
    text-align: left;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
      border-color: rgba(15, 23, 42, 0.15);
      background: #fff;
    }

    &.selected {
      border-color: rgba(15, 118, 110, 0.6);
      box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.25);
      background: #ecfeff;
    }

    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.85rem;
    }
  }

  .clothing-card__preview {
    background: #fff;
    border-radius: 0.9rem;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.25);

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .clothing-overlay-fade-enter-active,
  .clothing-overlay-fade-leave-active {
    transition: opacity 0.22s ease;
  }

  .clothing-overlay-fade-enter-from,
  .clothing-overlay-fade-leave-to {
    opacity: 0;
  }

  @media (max-width: 960px) {
    .clothing-overlay {
      padding: 1rem;
    }

    .clothing-overlay__panel {
      padding: 1.5rem;
    }

    .clothing-grid {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .clothing-grid--pair {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      justify-content: center;
    }
  }
</style>
