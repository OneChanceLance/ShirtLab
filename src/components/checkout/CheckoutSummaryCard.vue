<template>
  <section v-if="hasVariant || !cartIsEmpty" class="checkout-card">

    <div class="checkout-card__summary">
      <div class="checkout-card__preview" :class="{ 'has-image': Boolean(previewImage) }">
        <img :alt="` `" />
      </div>
      <div class="checkout-card__meta">
        <dl class="checkout-card__details">
          <div class="details">
            <dt>Product</dt>
            <dd>{{ productTitle }}</dd>
          </div>
          <div class="details">
            <dt>Color</dt>
            <dd>{{ colorName }}</dd>
          </div>
          <div class="details">
            <dt>Size</dt>
            <dd>{{ sizeLabel }}</dd>
          </div>
          <div v-if="priceLabel" class="details">
            <dt>Unit Price</dt>
            <dd>{{ priceLabel }}</dd>
          </div>
          <div class="details">
            <dt>Quantity</dt>
            <input class="quantity-control__input" type="number" :min="minimumQuantity || 1" :disabled="!hasVariant"
              v-model.number="quantityModel" />

          </div>
        </dl>
        <div class="checkout-card__controls">

          <div class="checkout-buttons">
            <button type="button" class="checkout-card__atc" :disabled="!hasVariant" @click="handlePrimaryAction">
              {{ primaryButtonLabel }}
            </button>
            <button type="button" class="checkout-card__view" :disabled="cartIsEmpty" @click="handleViewCart">
              View cart
            </button>
            <button type="button" class="checkout-card__cta" :disabled="cartIsEmpty" @click="handleCheckout">
              {{ cartIsEmpty ? 'Add items to cart' : 'Checkout' }}
            </button>
          </div>
        </div>
      </div>
    </div>


  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useCheckoutStore } from '../../stores/checkout';
  import { useCartStore } from '../../stores/cart';
  import type {
    AddCartItemPayload,
    CartItemDesignPreviews,
    CartItemBlankPreviews,
    CartItemCanvasPreviews,
    CartItemDesignCacheRefs,
    CartItemBlankCacheRefs,
    CartItemCanvasCacheRefs,
  } from '../../stores/cart';
  import { findMeasurementForSize } from '../../utils/sizeMeasurements';
  import { formatCurrency } from '../../utils/currency';
  import { calculatePricing } from '../../utils/pricing';
  import { describePreviewSource, type PreviewView } from '../../utils/previewPipeline';
  import { storeDataUrlInCache, isCachedAssetRef } from '../../utils/designCache';
  import { changeDpiDataUrl } from 'changedpi';
  import { startProcessingIndicator } from '../../composables/useProcessingIndicator';

  const checkoutStore = useCheckoutStore();
  const cartStore = useCartStore();
  const {
    product,
    color,
    size,
    hasVariant,
    minimumQuantity,
    sizeMeasurements,
    activeDesignPreview,
    designPreviews,
    designPreviewCacheRefs,
    canvasPreviews,
    canvasPreviewCacheRefs,
    blankDesignPreviews,
    blankDesignCacheRefs,
    editingCartItemId,
    isEditingCartItem,
  } = storeToRefs(checkoutStore);

  function hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(16);
  }

  const previewImage = computed<string | null>(() => {
    if (activeDesignPreview.value) return activeDesignPreview.value;
    const selected = color.value;
    if (!selected) return null;
    return selected.frontUrl || selected.backUrl || selected.sideUrl || null;
  });

  const productTitle = computed(() => {
    const details = product.value;
    if (!details || !details.name) return 'Selected Product';
    let name = details.name.trim();
    // Remove style code: split on last '-' and take the left part
    const dashIdx = name.lastIndexOf('-');
    if (dashIdx !== -1) {
      name = name.substring(0, dashIdx).trim();
    }
    // Remove brand: split on first '·' and take the right part
    const dotIdx = name.indexOf('·');
    if (dotIdx !== -1) {
      name = name.substring(dotIdx + 1).trim();
    }
    return name || 'Selected Product';
  });

  const colorName = computed(() => color.value?.name || 'Color not selected');
  const sizeLabel = computed(() => size.value || 'Size not selected');
  interface BuildPreviewOptions {
    includeFallback?: boolean;
  }

  function buildDesignPreviewPayload(options?: BuildPreviewOptions): CartItemDesignPreviews {
    const includeFallback = options?.includeFallback ?? true;
    const previews = designPreviews.value;
    const colorValue = color.value;

    const front = previews?.Front ?? (includeFallback ? previewImage.value ?? null : null);
    const back =
      previews?.Back ??
      (includeFallback
        ? (colorValue?.backUrl ||
            colorValue?.frontUrl ||
            colorValue?.sideUrl ||
            null)
        : null);

    return {
      Front: front,
      Back: back,
    };
  }

  function buildDesignPreviewCachePayload(): CartItemDesignCacheRefs {
    const refs = designPreviewCacheRefs.value;
    return {
      Front: refs?.Front ?? null,
      Back: refs?.Back ?? null,
    };
  }

  function buildBlankPreviewPayload(): CartItemBlankPreviews {
    const previews = blankDesignPreviews.value;
    return {
      Front: previews?.Front ?? null,
      Back: previews?.Back ?? null,
    };
  }

  function buildBlankCachePayload(): CartItemBlankCacheRefs {
    const refs = blankDesignCacheRefs.value;
    return {
      Front: refs?.Front ?? null,
      Back: refs?.Back ?? null,
    };
  }

  function buildCanvasPreviewPayload(): CartItemCanvasPreviews {
    const previews = canvasPreviews.value;
    return {
      Front: previews?.Front ?? null,
      Back: previews?.Back ?? null,
    };
  }

  function buildCanvasCachePayload(): CartItemCanvasCacheRefs {
    const refs = canvasPreviewCacheRefs.value;
    return {
      Front: refs?.Front ?? null,
      Back: refs?.Back ?? null,
    };
  }

  type PreviewBundle = {
    design: CartItemDesignPreviews;
    designCache: CartItemDesignCacheRefs;
    blank: CartItemBlankPreviews;
    blankCache: CartItemBlankCacheRefs;
    canvas: CartItemCanvasPreviews;
    canvasCache: CartItemCanvasCacheRefs;
  };

  async function ensureCacheForView(
    view: PreviewView,
    dataUrl: string | null,
    existingRef: string | null,
    label: string,
  ): Promise<string | null> {
    if (existingRef && isCachedAssetRef(existingRef)) return existingRef;
    if (!dataUrl || !dataUrl.startsWith('data:')) return existingRef;
    try {
      const stored = await storeDataUrlInCache(dataUrl, label);
      if (stored) {
        console.log('[CheckoutSummaryCard] Cached preview asset', { view, label, stored });
        return stored;
      }
    } catch (error) {
      console.warn('[CheckoutSummaryCard] Failed to cache preview asset', { view, label }, error);
    }
    return existingRef;
  }

  async function hydratePreviewBundleCaches(bundle: PreviewBundle, contextLabel: string) {
    const views: PreviewView[] = ['Front', 'Back'];
    await Promise.all(
      views.map(async (view) => {
        bundle.designCache[view] = await ensureCacheForView(
          view,
          bundle.design[view],
          bundle.designCache[view],
          `${contextLabel}-design-${view.toLowerCase()}`,
        );

        bundle.blankCache[view] = await ensureCacheForView(
          view,
          bundle.blank[view],
          bundle.blankCache[view],
          `${contextLabel}-blank-${view.toLowerCase()}`,
        );

        bundle.canvasCache[view] = await ensureCacheForView(
          view,
          bundle.canvas[view],
          bundle.canvasCache[view],
          `${contextLabel}-canvas-${view.toLowerCase()}`,
        );
      }),
    );
  }

  function to300(dataUrl: string | null): string | null {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
    const head = dataUrl.slice(0, 64).toLowerCase();
    if (!head.startsWith('data:image')) return dataUrl;
    if (head.includes('image/svg')) return dataUrl;
    try {
      return changeDpiDataUrl(dataUrl, 300);
    } catch {
      return dataUrl;
    }
  }

  function forceBundleDpi(bundle: PreviewBundle) {
    const views: PreviewView[] = ['Front', 'Back'];
    for (const v of views) {
      bundle.design[v] = to300(bundle.design[v]);
      bundle.blank[v] = to300(bundle.blank[v]);
      bundle.canvas[v] = to300(bundle.canvas[v]);
    }
  }

  function collectPreviewBundle(context: string): PreviewBundle {
    const bundle: PreviewBundle = {
      design: buildDesignPreviewPayload(),
      designCache: buildDesignPreviewCachePayload(),
      blank: buildBlankPreviewPayload(),
      blankCache: buildBlankCachePayload(),
      canvas: buildCanvasPreviewPayload(),
      canvasCache: buildCanvasCachePayload(),
    };
    // Force all data URLs to carry 300 DPI before we cache/upload anywhere.
    forceBundleDpi(bundle);
    logPreviewBundle(context, bundle);
    return bundle;
  }

  function logPreviewBundle(context: string, bundle: PreviewBundle) {
    try {
      console.groupCollapsed(`[CheckoutSummaryCard] Preview bundle · ${context}`);
      const rows = [
        {
          slot: 'design.Front',
          source: describePreviewSource(bundle.design.Front),
          cacheRef: bundle.designCache.Front ?? '<none>',
        },
        {
          slot: 'design.Back',
          source: describePreviewSource(bundle.design.Back),
          cacheRef: bundle.designCache.Back ?? '<none>',
        },
        {
          slot: 'blank.Front',
          source: describePreviewSource(bundle.blank.Front),
          cacheRef: bundle.blankCache.Front ?? '<none>',
        },
        {
          slot: 'blank.Back',
          source: describePreviewSource(bundle.blank.Back),
          cacheRef: bundle.blankCache.Back ?? '<none>',
        },
        {
          slot: 'canvas.Front',
          source: describePreviewSource(bundle.canvas.Front),
          cacheRef: bundle.canvasCache.Front ?? '<none>',
        },
        {
          slot: 'canvas.Back',
          source: describePreviewSource(bundle.canvas.Back),
          cacheRef: bundle.canvasCache.Back ?? '<none>',
        },
      ];
      console.table(rows);
      console.groupEnd();
    } catch (error) {
      console.warn('[CheckoutSummaryCard] Failed to log preview bundle', error, bundle);
    }
  }

  function logCartPayload(
    payload: AddCartItemPayload,
    breakdown: ReturnType<typeof calculatePricing>,
    context: string,
  ) {
    try {
      console.groupCollapsed(`[CheckoutSummaryCard] Cart payload · ${context}`);
      console.log('Variant', {
        product: payload.product?.name ?? payload.product?.id ?? '<none>',
        color: payload.color?.name ?? payload.color?.id ?? '<none>',
        size: payload.size ?? '<none>',
        quantity: payload.quantity,
        min: payload.minimumQuantity,
        designId: payload.designId,
      });
      console.log('Preview image', describePreviewSource(payload.previewImage));
      console.log('Pricing', {
        base: breakdown.basePrice,
        designCharge: breakdown.designChargeTotal,
        quantityDiscount: breakdown.quantityDiscount,
        finalUnit: breakdown.finalUnitPrice,
      });
      console.groupEnd();
    } catch (error) {
      console.warn('[CheckoutSummaryCard] Failed to log cart payload', error, payload);
    }
  }

  const ENABLE_PRICING_LOGS = true;

  function pricingLogger(message: string, details?: Record<string, unknown>) {
    if (!ENABLE_PRICING_LOGS) return;
    if (message === 'design:view-report' && details) {
      const view = (details.view as string) ?? 'View';
      const summary = details.summary as Record<string, any> | undefined;
      const items = Array.isArray(details.items) ? details.items as Record<string, any>[] : [];
      const summaryPayload = summary
        ? {
          bounds: summary.bounds
            ? {
              widthInches: Number(summary.bounds.widthInches ?? 0).toFixed(2),
              heightInches: Number(summary.bounds.heightInches ?? 0).toFixed(2),
              areaSquareInches: Number(summary.bounds.areaSquareInches ?? 0).toFixed(2),
            }
            : undefined,
          coverageRatio: typeof summary.coverageRatio === 'number'
            ? `${(summary.coverageRatio * 100).toFixed(1)}%`
            : null,
          priceTier: summary.priceTier ?? null,
          elementsCount: summary.elementsCount ?? items.length,
          sumAABBInchesSq: typeof summary.sumAABBInchesSq === 'number'
            ? Number(summary.sumAABBInchesSq).toFixed(2)
            : null,
          grid: summary.grid
            ? {
              widthInches: summary.grid.widthInches != null ? Number(summary.grid.widthInches).toFixed(2) : null,
              heightInches: summary.grid.heightInches != null ? Number(summary.grid.heightInches).toFixed(2) : null,
              areaSquareInches: summary.grid.areaSquareInches != null
                ? Number(summary.grid.areaSquareInches).toFixed(2)
                : null,
            }
            : undefined,
        }
        : null;

      const tableRows = items.map((item) => ({
        index: item.index,
        type: item.elementType ?? item.type ?? '',
        variant: item.elementVariant ?? '',
        name: item.name ?? '',
        size: `${Number(item.widthInches ?? 0).toFixed(2)}×${Number(item.heightInches ?? 0).toFixed(2)}`,
        areaSqIn: item.areaSquareInches != null ? Number(item.areaSquareInches).toFixed(2) : '',
        position: item.position
          ? `${Number(item.position.x ?? 0).toFixed(0)},${Number(item.position.y ?? 0).toFixed(0)}`
          : '',
        rotation: item.rotation ?? 0,
      }));

      console.groupCollapsed(`[Design Charge] ${view}`);
      if (summaryPayload) {
        console.log('Summary', summaryPayload);
      }
      if (tableRows.length) {
        console.table(tableRows);
      } else {
        console.log('No elements detected.');
      }
      console.groupEnd();
      return;
    }

    if (details) {
      console.log(`[Pricing] ${message}`, details);
      return;
    }
    console.log(`[Pricing] ${message}`);
  }

  function evaluateCurrentPricing(log = false) {
    const designState = checkoutStore.captureDesignState();
    const previews = buildDesignPreviewPayload({ includeFallback: false });
    return calculatePricing({
      basePrice: color.value?.price ?? null,
      designState: designState ?? null,
      designPreviews: previews,
      clothingDefinition: checkoutStore.clothingDefinition ?? null,
      quantity: checkoutStore.quantity,
      designMetrics: checkoutStore.designMetrics,
      logger: log ? pricingLogger : undefined,
    });
  }

  const previewPricing = computed(() => evaluateCurrentPricing(ENABLE_PRICING_LOGS));

  const priceLabel = computed(() => {
    const currency = color.value?.currency ?? cartStore.firstCurrency ?? 'USD';
    return formatCurrency(previewPricing.value.finalUnitPrice, currency);
  });

  const designId = computed(() => {
    const previews = designPreviews.value;
    const front = previews?.Front ?? '';
    const back = previews?.Back ?? '';
    const raw = `${front}::${back}`;
    if (!raw.trim()) return null;
    return `design-${hashString(raw)}`;
  });

  const quantityModel = computed({
    get: () => checkoutStore.quantity,
    set: (value: number | string) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      checkoutStore.setQuantity(numeric);
      checkoutStore.ensureMinimumQuantity();
    },
  });

  const measurementEntry = computed(() => findMeasurementForSize(sizeMeasurements.value, size.value ?? undefined));

  const cartItems = computed(() => cartStore.items);
  const cartIsEmpty = computed(() => cartStore.isEmpty);

  watch(cartItems, (items) => {
    if (!items.length) {
      checkoutStore.finishEditingCartItem();
      return;
    }
    const currentId = editingCartItemId.value;
    if (currentId && !items.some((item) => item.id === currentId)) {
      checkoutStore.finishEditingCartItem();
    }
  });

  let runningHighResGeneration: Promise<void> | null = null;
  let highResGenerationVersion = 0;
  const HIGH_RES_DEBOUNCE_MS = 750;

  async function ensureHighResPreviews() {
    if (typeof window === 'undefined') return;
    const generator = window.__shirtlabGenerateHighResPreviews;
    if (typeof generator !== 'function') {
      console.warn('[CheckoutSummaryCard] High-res generator is unavailable on window.');
      return;
    }

    // If a run is already in progress, reuse it
    if (runningHighResGeneration) {
      console.log('[CheckoutSummaryCard] Reusing in-flight high-res generation promise.');
      await runningHighResGeneration;
      return;
    }

    const currentVersion = ++highResGenerationVersion;
    console.log('[CheckoutSummaryCard] Starting high-res preview generation', {
      version: currentVersion,
    });
    runningHighResGeneration = (async () => {
      try {
        await Promise.race([
          generator(),
          new Promise<void>((resolve) => setTimeout(resolve, HIGH_RES_DEBOUNCE_MS)),
        ]);
        // Refresh previews after generation settles
        await nextTick();
        console.log('[CheckoutSummaryCard] High-res preview generation complete', {
          version: currentVersion,
        });
      } catch (error) {
        console.warn('[CheckoutSummaryCard] Failed to generate high-res previews', error);
      } finally {
        if (currentVersion === highResGenerationVersion) {
          runningHighResGeneration = null;
        }
      }
    })();

    await runningHighResGeneration;
  }

  async function addCurrentSelectionToCart() {
    if (!hasVariant.value) return;
    checkoutStore.ensureMinimumQuantity();
    console.log('[CheckoutSummaryCard] addCurrentSelectionToCart invoked', {
      quantity: checkoutStore.quantity,
      productId: product.value?.id,
      colorId: color.value?.id,
    });
    await ensureHighResPreviews();
    const payload = await buildCartPayload();
    cartStore.addItem(payload);
    console.log('[CheckoutSummaryCard] addCurrentSelectionToCart complete', {
      designId: payload.designId,
      quantity: payload.quantity,
    });
  }

  const showPrimaryFeedback = ref(false);

  const primaryButtonLabel = computed(() => {
    if (!hasVariant.value) return 'Select a product';
    if (showPrimaryFeedback.value) {
      return isEditingCartItem.value ? 'Item updated!' : 'Added to cart!';
    }
    return isEditingCartItem.value ? 'Update item' : 'Add to cart';
  });

  function clonePayload<T>(value: T): T {
    if (value === null || value === undefined) return value;
    try {
      return structuredClone(value);
    } catch (error) {
      return JSON.parse(JSON.stringify(value));
    }
  }

  async function buildCartPayload(): Promise<AddCartItemPayload> {
    const designState = checkoutStore.captureDesignState();
    const previewBundle = collectPreviewBundle(isEditingCartItem.value ? 'editing-item' : 'new-item');
    const designIdentifier = designId.value ?? `checkout-${Date.now().toString(36)}`;
    await hydratePreviewBundleCaches(previewBundle, designIdentifier);

    const breakdown = calculatePricing({
      basePrice: color.value?.price ?? null,
      designState: designState ?? null,
      designPreviews: previewBundle.design,
      clothingDefinition: checkoutStore.clothingDefinition ?? null,
      quantity: checkoutStore.quantity,
      designMetrics: checkoutStore.designMetrics,
    });

    const payload: AddCartItemPayload = {
      product: product.value ?? null,
      color: color.value ?? null,
      size: size.value ?? null,
      designId: designId.value,
      quantity: checkoutStore.quantity,
      minimumQuantity: minimumQuantity.value,
      unitPrice: breakdown.finalUnitPrice,
      currency: color.value?.currency ?? null,
      previewImage: previewImage.value,
      designPreviews: clonePayload(previewBundle.design),
      designPreviewCacheRefs: clonePayload(previewBundle.designCache),
      blankPreviews: clonePayload(previewBundle.blank),
      blankDesignCacheRefs: clonePayload(previewBundle.blankCache),
      canvasPreviews: clonePayload(previewBundle.canvas),
      canvasPreviewCacheRefs: clonePayload(previewBundle.canvasCache),
      measurement: measurementEntry.value,
      designState: clonePayload(designState ?? null),
      clothingDefinition: clonePayload(checkoutStore.clothingDefinition ?? null),
    };

    logCartPayload(payload, breakdown, isEditingCartItem.value ? 'editing-item' : 'new-item');
    return payload;
  }

  async function updateCurrentSelectionInCart() {
    const id = editingCartItemId.value;
    if (!id) return;
    console.log('[CheckoutSummaryCard] updateCurrentSelectionInCart', { id });
    await ensureHighResPreviews();
    const payload = await buildCartPayload();
    const nextId = cartStore.updateItem(id, payload);
    console.log('[CheckoutSummaryCard] updateCurrentSelectionInCart payload applied', {
      id,
      nextId,
      designId: payload.designId,
    });
    if (nextId) {
      checkoutStore.setEditingCartItemId(nextId);
    } else {
      checkoutStore.finishEditingCartItem();
    }
  }

  async function handlePrimaryAction() {
    if (!hasVariant.value) return;
    checkoutStore.ensureMinimumQuantity();
    const wasEditing = isEditingCartItem.value;
    console.log('[CheckoutSummaryCard] handlePrimaryAction', {
      wasEditing,
      quantity: checkoutStore.quantity,
    });
    if (wasEditing) {
      await updateCurrentSelectionInCart();
      checkoutStore.finishEditingCartItem();
      checkoutStore.setOpen(true);
    } else {
      await ensureHighResPreviews();
      const payload = await buildCartPayload();
      cartStore.addItem(payload);
      console.log('[CheckoutSummaryCard] handlePrimaryAction added item', {
        designId: payload.designId,
        quantity: payload.quantity,
      });
    }
    showPrimaryFeedback.value = true;
    setTimeout(() => {
      showPrimaryFeedback.value = false;
    }, 1200);
  }

  async function handleCheckout() {
    startProcessingIndicator();
    if (typeof window !== 'undefined' && typeof window.__shirtlabLogUploadPlan === 'function') {
      window.__shirtlabLogUploadPlan('checkout-button');
    }
    checkoutStore.ensureMinimumQuantity();
    console.log('[CheckoutSummaryCard] handleCheckout triggered', {
      cartIsEmpty: cartIsEmpty.value,
      hasVariant: hasVariant.value,
      isEditing: isEditingCartItem.value,
    });
    if (cartIsEmpty.value && hasVariant.value) {
      await addCurrentSelectionToCart();
    }
    if (isEditingCartItem.value) {
      await updateCurrentSelectionInCart();
    }
    checkoutStore.setOpen(true);
    checkoutStore.markCheckoutPressed();
    console.log('[CheckoutSummaryCard] Checkout drawer opened from summary card.');
  }

  function handleViewCart() {
    if (cartIsEmpty.value) return;
    console.log('[CheckoutSummaryCard] Opening cart panel from summary card.');
    cartStore.openPanel();
  }
</script>

<style scoped>
  .checkout-card {
    width: auto;
    padding: 0.5rem 1rem;
    background-color: rgb(75, 85, 93);
    backdrop-filter: blur(16px);
    box-shadow: 0 18px 42px rgba(14, 23, 42, 0.5);
    color: #e2e8f0;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 5;
  }

  .checkout-card__summary {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .checkout-card__preview {


    height: 5rem;
    border-radius: 10px;

    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .checkout-card__preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 1;

  }

  .checkout-card__placeholder {
    font-size: 0.8rem;
    text-align: center;
    color: rgba(226, 232, 240, 0.7);
    padding: 0.5rem;
  }

  .checkout-card__meta {
    display: flex;
    flex: 1;
    justify-content: space-between;
    gap: 1.5rem;
    align-items: flex-end;
  }

  .checkout-card__details {
    display: flex;
    gap: 0.75rem 1.5rem;
    margin: 0;
    text-align: left;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .checkout-card__details dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.65);
  }

  .checkout-card__details dd {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 500;
    color: #f8fafc;
  }

  .checkout-card__controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-left: auto;
    min-width: 220px;
  }



  .quantity-control__input {
    width: 70px;
    padding: 0rem;
    border-radius: 5px;
    border: transparent;
    background: transparent;
    color: #f8fafc;
    text-align: left;
    font-size: 0.95rem;
  }

  .quantity-control__input input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quantity-control__hint {
    margin: 0;
    font-size: 0.75rem;
    color: rgba(226, 232, 240, 0.65);
  }

  .checkout-card__cta {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    color: #0f172a;
    background: linear-gradient(135deg, #9ae67b, #a4f08d);
    transition: transform 0.18s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .checkout-card__cta:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
  }

  .checkout-card__cta:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 18px rgba(148, 201, 64, 0.45);
  }

  .checkout-card__atc {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    color: #ebebeb;
    background: linear-gradient(135deg, #7bc1e6, #8de4f0);
    transition: transform 0.18s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .checkout-card__atc:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
  }

  .checkout-card__atc:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 18px rgba(64, 171, 201, 0.45);
  }

  .checkout-card__view {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(148, 163, 184, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.2s ease, opacity 0.2s ease, background 0.2s ease;
  }

  .checkout-card__view:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
  }

  .checkout-card__view:not(:disabled):hover {
    transform: translateY(-2px);
    background: rgba(148, 163, 184, 0.28);
    box-shadow: 0 10px 18px rgba(148, 163, 184, 0.28);
  }

  .checkout-buttons {
    display: flex;
    flex-direction: row;
    margin-left: auto;
    gap: 0.5rem;
  }

  .checkout-card__cart {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background: rgba(15, 23, 42, 0.35);
    border-radius: 16px;
    border: 1px solid rgba(15, 23, 42, 0.35);
  }

  .cart-summary__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .cart-summary__header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .cart-summary__clear {
    border: 1px solid rgba(226, 232, 240, 0.3);
    background: transparent;
    color: #cbd5f5;
    border-radius: 999px;
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 0.18s ease, border-color 0.18s ease;
  }

  .cart-summary__clear:hover {
    color: #f8fafc;
    border-color: rgba(226, 232, 240, 0.5);
  }

  .cart-summary__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .cart-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 1rem;
    align-items: center;
  }

  .cart-item__preview {
    width: 64px;
    height: 64px;
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.65);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  .cart-item__preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cart-item__placeholder {
    font-size: 0.75rem;
    color: rgba(226, 232, 240, 0.65);
    text-align: center;
    padding: 0.2rem;
  }

  .cart-item__info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .cart-item__name {
    margin: 0;
    font-weight: 600;
    font-size: 0.95rem;
    color: #f1f5f9;
  }

  .cart-item__variant {
    margin: 0;
    font-size: 0.82rem;
    color: rgba(226, 232, 240, 0.75);
  }

  .cart-item__unit {
    margin: 0;
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.6);
  }

  .cart-item__quantity {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .cart-item__quantity button {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    border: none;
    background: rgba(148, 201, 64, 0.25);
    color: #0f172a;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.18s ease, background 0.18s ease, opacity 0.18s ease;
  }

  .cart-item__quantity button:hover {
    transform: translateY(-1px);
    background: rgba(148, 201, 64, 0.38);
  }

  .cart-item__quantity input {
    width: 64px;
    padding: 0.4rem 0.3rem;
    border-radius: 8px;
    border: 1px solid rgba(226, 232, 240, 0.32);
    background: rgba(15, 23, 42, 0.45);
    color: #f8fafc;
    text-align: center;
    font-size: 0.85rem;
  }

  .cart-item__hint {
    margin: 0;
    font-size: 0.7rem;
    color: rgba(226, 232, 240, 0.6);
  }

  .cart-item__total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.45rem;
    color: #f8fafc;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .cart-item__remove {
    border: none;
    background: transparent;
    color: rgba(248, 113, 113, 0.85);
    cursor: pointer;
    font-size: 0.75rem;
    transition: color 0.18s ease;
  }

  .cart-item__remove:hover {
    color: rgba(248, 113, 113, 1);
  }

  .cart-summary__footer {
    margin-top: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .checkout-card__cart-empty {
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.7);
    padding: 1rem;
    border: 1px dashed rgba(226, 232, 240, 0.25);
    border-radius: 12px;
    text-align: center;
  }

  @media (max-width: 900px) {
    .checkout-card__details {
      grid-template-columns: minmax(0, 1fr);
    }

    .checkout-card__controls {
      min-width: 180px;
    }
  }

  @media (max-width: 768px) {
    .checkout-card__summary {
      flex-direction: column;
      align-items: stretch;
    }

    .checkout-card__meta {
      flex-direction: column;
      gap: 1.25rem;
    }

    .checkout-card__controls {
      width: 100%;
      margin-left: 0;
    }

    .checkout-buttons {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .checkout-card__preview {
      width: 100%;
      height: 220px;
    }

    .cart-item {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(226, 232, 240, 0.18);
    }

    .cart-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .cart-item__preview {
      width: 100%;
      height: 180px;
    }

    .cart-item__quantity {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
    }

    .cart-item__total {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }
</style>
