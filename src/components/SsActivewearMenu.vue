<template>
  <section class="ssa-menu">
    <header class="ssa-menu__header">
      <h2>S&amp;S Activewear Library</h2>
      <p>Select a product, color, and size to preview it in ShirtLab.</p>
    </header>

    <form class="ssa-menu__form" @submit.prevent="fetchProduct">
      <label class="ssa-menu__label" for="ssa-input">Style / Product ID</label>
      <div class="ssa-menu__input-row">
        <input id="ssa-input" v-model="productInput" type="text" placeholder="e.g. 3001CVC" autocomplete="off" />
        <button type="submit" :disabled="loading">
          {{ loading ? 'Loading…' : 'Fetch' }}
        </button>
      </div>
    </form>

    <p v-if="error" class="ssa-menu__error">{{ error }}</p>

    <section v-if="product || colors.length" class="ssa-menu__results">
      <div v-if="product" class="ssa-menu__product-header">
        <h3>
          {{ product.brand || 'S&S Activewear' }}
          <span v-if="product.name"> · {{ product.name }}</span>
          <span class="ssa-menu__style"> · {{ product.id }}</span>
        </h3>

      </div>

      <div v-if="colors.length" class="ssa-menu__block">
        <h4>Colors</h4>
        <div class="ssa-menu__colors">
          <button type="button" class="ssa-menu__color" :class="{ 'is-selected': index === selectedColorIndex }"
            v-for="(color, index) in colors" :key="color.id || index" @click="selectColor(index)">
            <span class="ssa-menu__swatch" :style="swatchStyle(color)"></span>
            <span class="ssa-menu__color-name">{{ color.name || color.id || `Color ${index + 1}` }}</span>
          </button>
        </div>
      </div>

      <div v-if="availableSizes.length" class="ssa-menu__block">
        <h4>Sizes</h4>
        <select v-model="selectedSize">
          <option v-for="size in availableSizes" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </div>

    </section>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import {
    PRODUCT_COLORS,
    setProductColors,
    selectedProductColorIndex,
    setSelectedProductColorIndex,
    selectedProductSize,
    setSelectedProductSize,
  } from './sideMenu/types/colorList';
  import { extractSizeMeasurementsFromPromo } from '../utils/sizeMeasurements';
  import type { SizeMeasurementEntry } from '../utils/sizeMeasurements';

  interface PromoMedia {
    url: string;
    location?: string | null;
    description?: string | null;
    fileType?: string | null;
    color?: string | null;
    partId?: string | null;
    classType?: string | null;
  }

  interface PromoColor {
    id: string;
    name: string;
    hex?: string | null;
    sizes: string[];
    media?: PromoMedia[];
    frontUrl?: string | null;
    backUrl?: string | null;
    price?: number | null;
    currency?: string | null;
    quantityMin?: number | null;
  }

  interface PromoProduct {
    id: string;
    brand?: string | null;
    name?: string | null;
    description?: string | null;
    defaultColorId?: string | null;
    colors: PromoColor[];
  }

  interface PromoResponse {
    product: PromoProduct;
    raw?: unknown;
  }

  const emit = defineEmits<{
    (e: 'variant-selected', payload: {
      product: PromoProduct;
      color: PromoColor;
      size: string | null;
      imagery: {
        front?: string;
        back?: string;
        colors?: Array<Record<string, unknown>>;
        grid?: any;
        bgTransform?: any;
      };
      sizeMeasurements?: SizeMeasurementEntry[];
    }): void;
  }>();

  const productInput = ref('');
  const loading = ref(false);
  const error = ref('');
  const product = ref<PromoProduct | null>(null);
  const selectedColorIndex = ref(0);
  const selectedSize = computed<string | null>({
    get: () => selectedProductSize.value,
    set: (value) => setSelectedProductSize(value ?? null),
  });
  const sizeMeasurements = ref<SizeMeasurementEntry[]>([]);

  const colors = computed(() => {
    if (product.value?.colors?.length) return product.value.colors;
    return PRODUCT_COLORS.value;
  });
  const activeColor = computed(() => colors.value[selectedColorIndex.value] ?? null);
  const availableSizes = computed(() => activeColor.value?.sizes ?? []);
  const previewFront = computed(() => {
    const color = activeColor.value as any;
    if (!color) return '';
    return (
      color.frontUrl ||
      color.media?.find((m: PromoMedia) => /front|primary/i.test(m.classType || m.location || m.description || ''))?.url ||
      color.media?.[0]?.url ||
      ''
    );
  });
  const previewBack = computed(() => {
    const color = activeColor.value as any;
    if (!color) return '';
    return (
      color.backUrl ||
      color.media?.find((m: PromoMedia) => /rear|back/i.test(m.classType || m.location || m.description || ''))?.url ||
      ''
    );
  });

  watch(activeColor, () => {
    const sizes = availableSizes.value;
    if (sizes.length) {
      selectedSize.value = sizes[0];
    } else if (sizeMeasurements.value.length) {
      selectedSize.value = sizeMeasurements.value[0].sizeLabel;
    } else {
      selectedSize.value = null;
    }
    emitSelection();
  });

  watch(selectedSize, () => {
    emitSelection();
  });

  watch(selectedColorIndex, (idx) => {
    if (idx !== selectedProductColorIndex.value) {
      setSelectedProductColorIndex(idx);
    }
  });

  watch(() => selectedProductColorIndex.value, (idx) => {
    if (idx !== selectedColorIndex.value && idx >= 0 && idx < colors.value.length) {
      selectColor(idx);
    }
  });

  watch(colors, (list) => {
    if (!list.length) {
      selectedColorIndex.value = 0;
      selectedSize.value = sizeMeasurements.value[0]?.sizeLabel ?? null;
      return;
    }
    if (selectedColorIndex.value >= list.length) {
      selectColor(Math.max(0, list.length - 1));
    }
  });

  function swatchStyle(color: PromoColor | null) {
    const style: Record<string, string> = {
      backgroundColor: '#e5e7eb',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
    if (!color) return style;

    const hex = typeof color.hex === 'string' ? color.hex.trim() : '';
    if (hex) {
      style.backgroundColor = hex;
      style.backgroundImage = 'none';
      return style;
    }

    const mediaUrl = color.frontUrl
      || color.media?.find((m) => /front|primary/i.test(m.classType || m.location || m.description || ''))?.url
      || color.media?.[0]?.url
      || '';

    if (mediaUrl) {
      style.backgroundImage = `url(${mediaUrl})`;
      style.backgroundColor = 'transparent';
    }

    return style;
  }

  async function fetchProduct() {
    const style = productInput.value.trim();
    if (!style) {
      error.value = 'Enter a style or product identifier.';
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promostandards-product`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ productId: style }),
      });

      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        throw new Error(details.error || 'Failed to load PromoStandards product.');
      }

      const data = await res.json() as PromoResponse;
      if (!data?.product?.colors?.length) {
        throw new Error('This style did not return any colors.');
      }

      const rawProduct = (data.raw as Record<string, any> | undefined)?.Product;
      sizeMeasurements.value = extractSizeMeasurementsFromPromo(rawProduct);
      product.value = {
        ...data.product,
        sizeMeasurements: sizeMeasurements.value,
      } as PromoProduct & { sizeMeasurements: SizeMeasurementEntry[] };
      setProductColors(data.product.colors ?? []);
      const colorsList = data.product.colors ?? [];
      let initialIndex = 0;
      if (data.product.defaultColorId) {
        const idx = colorsList.findIndex((color) => color.id === data.product.defaultColorId);
        if (idx >= 0) initialIndex = idx;
      }
      selectedColorIndex.value = initialIndex;
      const defaultSize = colorsList[initialIndex]?.sizes?.[0]
        ?? sizeMeasurements.value[0]?.sizeLabel
        ?? null;
      selectedSize.value = defaultSize;
      setSelectedProductColorIndex(initialIndex);
    } catch (err: any) {
      console.error('PromoStandards fetch error', err);
      error.value = err?.message || 'Unexpected error fetching product.';
      product.value = null;
      selectedColorIndex.value = 0;
      sizeMeasurements.value = [];
      selectedSize.value = null;
      setProductColors([]);
      setSelectedProductColorIndex(0);
    } finally {
      loading.value = false;
    }
  }

  function selectColor(index: number) {
    if (index < 0 || index >= colors.value.length) return;
    selectedColorIndex.value = index;
  }

  function findMedia(color: PromoColor | null, keyword: RegExp): string | undefined {
    if (!color?.media?.length) return undefined;
    const match = color.media.find((item: PromoMedia) => keyword.test(item.classType ?? item.location ?? item.description ?? ''));
    return match?.url ?? undefined;
  }

  function emitSelection() {
    if (!product.value) return;
    const color = activeColor.value;
    if (!color) return;

    const front = previewFront.value || color.frontUrl || findMedia(color, /front|primary/i) || color.media?.[0]?.url;
    const back = previewBack.value
      || color.backUrl
      || findMedia(color, /back|rear/i)
      || color.media?.find((item: PromoMedia) => item.url !== front)?.url;

    const emitColor = {
      name: color.name,
      colorBackground: color.hex ?? '',
      colorStyleID: color.id,
      background: color.hex ?? '',
      frontUrl: front,
      backUrl: back,
      media: color.media ?? [],
      price: color.price ?? null,
      currency: color.currency ?? null,
      quantityMin: color.quantityMin ?? null,
    } as Record<string, unknown>;

    emit('variant-selected', {
      product: product.value,
      color,
      size: selectedSize.value,
      imagery: {
        front,
        back,
        colors: [emitColor],
        grid: (color as any)?.grid ?? null,
        bgTransform: (color as any)?.bgTransform ?? null,
      },
      sizeMeasurements: sizeMeasurements.value,
    });
  }
</script>

<style scoped>
  .ssa-menu {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: #f8f9fb;
    border-radius: 12px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
    width: 360px;
    max-width: 100%;
    color: #1f2937;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .ssa-menu__header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .ssa-menu__header p {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: #4b5563;
  }

  .ssa-menu__form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ssa-menu__label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .ssa-menu__input-row {
    display: flex;
    gap: 0.5rem;
  }

  .ssa-menu__input-row input {
    flex: 1;
    padding: 0.6rem 0.75rem;
    border: 1px solid #cbd5f5;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .ssa-menu__input-row button {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .ssa-menu__input-row button[disabled] {
    background: #9ca3af;
    cursor: progress;
  }

  .ssa-menu__hint {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .ssa-menu__error {
    color: #dc2626;
    font-weight: 500;
  }

  .ssa-menu__results {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ssa-menu__product-header h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
  }

  .ssa-menu__style {
    font-weight: 500;
    color: #64748b;
  }

  .ssa-menu__product-header p {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: #4b5563;
  }

  .ssa-menu__block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ssa-menu__colors {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .ssa-menu__color {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #cbd5f5;
    background: #fff;
    cursor: pointer;
    font-size: 0.85rem;
    transition: border-color 0.2s, background 0.2s;
  }

  .ssa-menu__color.is-selected {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .ssa-menu__swatch {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 1px solid rgba(15, 23, 42, 0.12);
  }

  .ssa-menu__color-name {
    white-space: nowrap;
  }

  .ssa-menu__block select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    border: 1px solid #cbd5f5;
    background: #fff;
    font-size: 0.9rem;
  }

  .ssa-menu__previews {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .ssa-menu__preview {
    width: 120px;
    background: #fff;
    border-radius: 0.75rem;
    padding: 0.5rem;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .ssa-menu__preview img {
    width: 100%;
    height: auto;
    object-fit: contain;
    border-radius: 0.5rem;
  }

  .ssa-menu__preview figcaption {
    font-size: 0.75rem;
    color: #4b5563;
  }

  .ssa-menu__meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.5rem;
    font-size: 0.8rem;
    color: #4b5563;
  }

  .ssa-menu__meta dt {
    font-weight: 600;
  }
</style>
