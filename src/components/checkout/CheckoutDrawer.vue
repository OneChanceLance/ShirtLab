<template>
  <transition name="checkout-overlay-fade">
    <div v-if="isOpen" class="checkout-overlay" role="dialog" aria-modal="true" @click.self="close">
      <div class="checkout-overlay__container">
        <div ref="panelRef" class="checkout-overlay__panel" tabindex="-1" @keydown.esc.prevent="close">
          <header class="checkout-shell__header">
            <span class="checkout-shell__eyebrow">Checkout</span>
            <div class="checkout-shell__actions">
              <button type="button" class="checkout-shell__back" @click="goBack" :disabled="!canGoBack"
                :aria-disabled="!canGoBack">
                Back
              </button>
              <span class="checkout-shell__close" @click="close">Close</span>
            </div>
          </header>

          <div v-if="uploadProgress.active" class="checkout-upload-progress" role="status">
            <div class="checkout-upload-progress__label">
              Uploading {{ uploadProgress.current }} / {{ uploadProgress.total }} — {{ uploadProgress.label }}
            </div>
            <div class="checkout-upload-progress__bar">
              <div class="checkout-upload-progress__fill" :style="{ width: `${uploadProgressPercent}%` }"></div>
            </div>
          </div>

          <ul class="checkout-shell__progress" role="list">
            <li class="checkout-shell__progress-step"
              :class="{ 'is-active': currentStep === 1, 'is-complete': step1Complete }">
              <span class="step-index">1</span>
              <span>Review items</span>
            </li>
            <li class="checkout-shell__progress-step"
              :class="{ 'is-active': currentStep === 2, 'is-complete': step2Complete }">
              <span class="step-index">2</span>
              <span>Contact details</span>
            </li>
            <li class="checkout-shell__progress-step"
              :class="{ 'is-active': currentStep === 3, 'is-complete': step3Complete }">
              <span class="step-index">3</span>
              <span>Payment Options</span>
            </li>
          </ul>


          <div v-if="hasCartItems" class="checkout-shell__content">
            <div class="checkout-shell__grid">
              <main v-if="currentStep === 1" class="checkout-shell__main">
                <section class="checkout-cart">
                  <header class="checkout-card__header">
                    <div>
                      <span>Cart</span>
                      <span>{{ cartItemCount }} {{ cartItemCount == 1 ? `item` : `items` }}</span>
                    </div>
                  </header>
                  <ul class="checkout-cart__list">
                    <li v-for="item in cartItems" :key="item.id"
                      :class="['checkout-cart__item', { active: item.id === activeCartItemId }]">
                      <button type="button" class="checkout-cart__select" @click="selectCartItem(item)"
                        :aria-pressed="item.id === activeCartItemId">
                        <span class="checkout-cart__thumb" :class="{ 'has-image': Boolean(item.previewImage) }">
                          <img v-if="item.previewImage" :src="item.previewImage"
                            :alt="`Preview of ${cartItemVariantLabel(item)}`" />
                          <span v-else>Preview</span>
                        </span>
                        <span class="checkout-cart__copy">
                          <span class="title">{{ item.product?.name ?? 'Selected Product' }}</span>
                          <span class="variant">{{ cartItemVariantLabel(item) }}</span>
                          <span class="qty">Qty {{ item.quantity }}</span>
                        </span>
                      </button>
                      <div class="checkout-cart__actions">
                        <button type="button" @click="decrementCartItemQuantity(item)"
                          aria-label="Decrease item quantity">
                          −
                        </button>
                        <button type="button" @click="incrementCartItemQuantity(item)"
                          aria-label="Increase item quantity">
                          +
                        </button>
                        <button type="button" class="remove" @click="removeCartItem(item.id)">
                          Remove
                        </button>
                      </div>
                    </li>
                    <li :key="'newitem'" class="checkout-cart__item checkout-cart__item--new">
                      <button type="button" class="checkout-cart__add" aria-label="Add a new item"
                        @click="handleAddNewItem">
                        <span class="checkout-cart__add-icon" aria-hidden="true">
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none"
                            viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                              stroke-linejoin="round" d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                        <span class="checkout-cart__add-label">Add another item</span>
                      </button>
                    </li>
                  </ul>
                </section>
                <section class="checkout-preview" aria-live="polite">

                  <div class="checkout-preview__viewer">
                    <div class="checkout-preview__controls">
                      <button v-for="view in previewViews" :key="view" type="button" class="checkout-preview__control"
                        :class="{ active: previewView === view }" :disabled="!previewAvailability[view]"
                        :aria-pressed="previewView === view" @click="setPreviewView(view)">
                        {{ viewLabels[view] }}
                      </button>
                      <button type="button" class="checkout-preview__control" :class="{ active: showDesignOnly }"
                        :disabled="!hasDesignOnlyAny" :aria-pressed="showDesignOnly"
                        @click="showDesignOnly = !showDesignOnly">
                        Design only
                      </button>
                    </div>
                    <div class="checkout-preview__frame" :class="{ 'has-image': Boolean(activePreviewSrc) }">
                      <img v-if="activePreviewSrc" :src="activePreviewSrc"
                        :alt="`${viewLabels[previewView]} view of ${activeCartItem?.product?.name ?? 'selected item'}`" />
                      <div v-else class="checkout-preview__empty">
                        Select an item to see its preview
                      </div>
                    </div>
                  </div>

                </section>
              </main>
              <section v-if="currentStep === 2" class="checkout-form-card">

                <form id="checkout-contact-form" class="checkout-form" @submit.prevent="submit">
                  <div class="checkout-form__grid">
                    <label>
                      <span>Full name</span>
                      <input type="text" v-model="fullNameField" placeholder="Alex Taylor" required />
                    </label>
                    <label>
                      <span>Email</span>
                      <input type="email" v-model="emailField" placeholder="alex@example.com" required />
                    </label>
                    <label>
                      <span>Phone</span>
                      <input type="tel" :value="phoneField" @input="(e => {
                        var element = e.target as HTMLInputElement;
                        const digits = element.value.replace(/\D/g, '').slice(0, 10);
                        let formatted = digits;
                        if (digits.length > 3 && digits.length <= 6) {
                          formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                        } else if (digits.length > 6) {
                          formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                        }
                        phoneField = formatted;
                      })($event)" placeholder="(555) 123-4567" required />
                    </label>
                    <label>
                      <span>Company</span>
                      <input type="text" v-model="companyField" placeholder="Your company (optional)" />
                    </label>
                    <label class="checkout-form__notes">
                      <span>Order notes</span>
                      <textarea rows="4" v-model="notesField"
                        placeholder="Share artwork details, deadlines, and special requests"></textarea>
                    </label>
                  </div>
                  <div class="checkout-summary">
                    <div class="checkout-summary__section">
                      <div v-for="detail in cartPricingDetails" :key="detail.item.id" class="checkout-summary__item">
                        <div class="summary-item__info">
                          <span class="summary-item__title">
                            {{ detail.item.product?.name ?? 'Custom apparel' }}
                            <template v-if="detail.item.quantity > 1"> ({{ detail.item.quantity }}x)</template>
                          </span>
                          <ul class="summary-item__charges">
                            <li>
                              <span>Garment base</span>
                              <strong>{{ detail.formatted.basePerUnit ?? '—' }}</strong>
                            </li>
                            <li v-for="(charge, idx) in detail.breakdown.designCharges" :key="idx">
                              <span>
                                {{ designChargeLabel(charge) }}
                                <small v-if="designChargeMeta(charge)">
                                  {{ designChargeMeta(charge) }}
                                </small>
                                <small v-if="designChargeItemsSummary(charge)">
                                  {{ designChargeItemsSummary(charge) }}
                                </small>
                              </span>
                              <strong>{{ formatCurrency(charge.charge, detail.currency ?? cartStore.firstCurrency ??
                                'USD') }}</strong>
                            </li>
                          </ul>
                        </div>
                        <div class="summary-item__total">
                          <strong>{{ detail.formatted.unitPrice ?? '—' }}</strong>
                          <small>Per item total</small>
                        </div>
                      </div>
                    </div>
                    <div v-if="cartPricingSummary.hasDiscount" class="checkout-summary__section">
                      <div class="checkout-summary__discount">
                        <span>
                          Quantity discount
                        </span>
                        <strong>-{{ cartPricingSummary.discountLabel ?? '—' }}</strong>
                      </div>
                    </div>
                    <div class="checkout-summary__section summary-taxes">
                      <div class="checkout-summary__item summary-tax">
                        <span>Tax: </span>
                        <strong>{{ cartPricingSummary.taxLabel ?? '—' }}</strong>
                      </div>
                      <div class="checkout-summary__item summary-tax">
                        <span>Processing fee:</span>
                        <strong>{{ cartPricingSummary.stripeFeeLabel ?? '—' }}</strong>
                      </div>
                    </div>
                    <div class="checkout-summary__total">
                      <span>Total due today</span>
                      <strong>{{ formatCurrency((cartPricingSummary.finalTotal + cartPricingSummary.taxAmount +
                        cartPricingSummary.stripeFees), cartPricingSummary.currency ?? cartStore.firstCurrency ?? 'USD')
                        ?? '—' }}</strong>
                    </div>
                  </div>

                  <p v-if="checkoutError" class="checkout-form__error">
                    {{ checkoutError }}
                  </p>
                </form>
              </section>
              <section v-if="currentStep === 3" class="checkout-form-card-striper">
                <header class="checkout-card__header">
                  <div>
                    <p v-if="requestStatus === 'success'">Payment complete! We’ll follow up by email.</p>
                    <p v-else-if="requestStatus === 'processing'">Confirming your payment…</p>
                  </div>
                </header>
                <template v-if="requestStatus === 'success'">
                  <div class="checkout-payment__success">
                    <p>Thanks! Your payment was received. We’ll be in touch shortly with next steps.</p>
                    <button type="button" class="checkout-form__submit" @click="close">
                      Close
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div v-if="!stripeConfigured" class="checkout-payment__error">
                    <p>Payment is unavailable right now. Please contact us to complete your order.</p>

                  </div>
                  <div v-else class="checkout-payment">
                    <div class="checkout-payment__element" :class="{ 'is-loading': !paymentElementReady }">
                      <div ref="paymentElementRef" class="checkout-payment__mount"></div>
                      <div v-if="!paymentElementReady" class="checkout-payment__loading">
                        Preparing secure payment form…
                      </div>
                    </div>
                    <p v-if="paymentError" class="checkout-form__error">
                      {{ paymentError }}
                    </p>

                  </div>
                </template>
              </section>
            </div>
          </div>

          <div v-else>
            <div class="checkout-overlay__empty">
              <p>Your cart is empty. Add items to continue.</p>
              <button type="button" @click="close">Go back</button>
            </div>
          </div>
        </div>
        <footer v-if="hasCartItems" class="checkout-shell__footer">
          <div class="checkout-shell__footer-actions">
            <button type="button" class="checkout-form__submit" @click="goBack" :disabled="!canGoBack">
              Back
            </button>
            <div class="details">
              <div>
                <span>Total items</span>
                <span>{{ cartItemCount }}</span>
              </div>
              <div>
                <span>Subtotal</span>
                <span>{{ cartSubtotalLabel ?? '—' }}</span>
              </div>

            </div>
            <button v-if="currentStep === 1" type="button" class="checkout-form__secondary"
              @click="openExportPreviewOverlay">
              Preview export images
            </button>
            <button v-if="currentStep === 1" type="button" class="checkout-form__submit" @click="proceedToContact">
              Proceed
            </button>
            <button v-else-if="currentStep === 2" type="submit" class="checkout-form__submit"
              form="checkout-contact-form" :disabled="submitting">
              {{ submitting ? 'Proceeding...' : 'Proceed to Payment' }}
            </button>
            <button v-else-if="currentStep === 3" type="button" class="checkout-form__submit"
              :disabled="!paymentFormReady || paymentProcessing" @click="confirmPayment">
              {{ paymentProcessing ? 'Processing…' : 'Pay now' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </transition>
  <transition name="export-preview-fade">
    <div v-if="exportPreviewOverlay.open" class="export-preview-overlay" role="dialog" aria-modal="true"
      @click.self="closeExportPreviewOverlay">
      <div class="export-preview-overlay__panel">
        <header class="export-preview-overlay__header">
          <div>
            <h2>Design export preview</h2>
            <p>These are the images queued for Supabase storage.</p>
          </div>
          <button type="button" class="export-preview-overlay__close" @click="closeExportPreviewOverlay">
            Close
          </button>
        </header>
        <div class="export-preview-overlay__content">
          <div v-for="item in exportPreviewOverlay.items" :key="item.cartItemId" class="export-preview-item">
            <div class="export-preview-item__header">
              <h3>{{ item.itemLabel }}</h3>
              <span>{{ item.variantLabel }} · Qty {{ item.quantity }}</span>
            </div>
            <div class="export-preview-item__grid">
              <figure v-for="preview in item.previews" :key="`${item.cartItemId}-${preview.key}`"
                class="export-preview-card">
                <div class="export-preview-card__image">
                  <img v-if="preview.url" :src="preview.url" :alt="`${preview.label} for ${item.itemLabel}`" />
                  <span v-else class="export-preview-card__placeholder">Not available</span>
                </div>
                <figcaption>{{ preview.label }}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
  /**
   * ------------------------------------------------------------
   * CheckoutDrawer.vue — OVERVIEW & FLOW
   * ------------------------------------------------------------
   * Goals:
   * - 3-step checkout (Review → Contact → Payment)
   * - Show previews (WITH shirt vs BLANK/design-only) for Front/Back
   * - Upload previews + assets to Supabase, then insert order
   *
   * Flow (happy path):
   * 1) Step 1: Build preview candidates per item; user can toggle front/back & design-only.
   * 2) Step 2: Validate contact; submit() requests Stripe clientSecret (or bypass).
   * 3) Step 3: confirmPayment(); on success → recordOrderIfNeeded() uploads & inserts order.
   *
   * Why so many variables?
   * - We keep separate sources for:
   *   • WITH shirt (customer-facing proof)
   *   • BLANK design-only (print pipeline)
   * - We track both "live" (editing) and "persisted" (saved) previews for resilience.
   * - Upload/print needs DPI stamping, cache keys, CORS safety, and fallbacks → more params.
   *
   * TL;DR: the variables exist to keep previews correct, uploads idempotent, and the UI snappy.
   */
  import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { changeDpiBlob, changeDpiDataUrl } from 'changedpi';
  import { useCheckoutStore } from '../../stores/checkout';
  import { useCartStore } from '../../stores/cart';
  import type { CartItem } from '../../stores/cart';
  import { formatCurrency } from '../../utils/currency';
  import { calculatePricing } from '../../utils/pricing';
  import { supabase } from '../../supabase';
  import { uploadBlobToFirebase, upscalePngBlobForUpload } from '../../utils/firebaseUploads';
  import type { DesignViewName, SerializedDesignState } from '../../types/designState';
  import {
    isCachedAssetRef,
    getCachedBlob,
    resolveCachedRefFromObjectUrl,
    type CachedAssetRef,
    touchCachedObjectUrl,
  } from '../../utils/designCache';
  import {
    dedupePreviewList,
    describePreviewSource,
    logPreviewBuckets,
    normalizePreview,
    preferNonBlobSources,
  } from '../../utils/previewPipeline';
  import {
    startProcessingIndicator,
    finishProcessingIndicator,
    markProcessingVariant,
  } from '../../composables/useProcessingIndicator';

  type StripeConfirmResult = {
    error?: { message?: string } | null;
    paymentIntent?: { status?: string | null } | null;
  };

  interface StripePaymentElement {
    mount(element: HTMLElement): void;
    unmount(): void;
  }

  interface StripeElements {
    create(component: 'payment', options?: Record<string, unknown>): StripePaymentElement;
  }

  interface StripeInstance {
    elements(options: { clientSecret: string; appearance?: Record<string, unknown> }): StripeElements;
    confirmPayment(options: {
      elements: StripeElements;
      confirmParams?: { return_url?: string };
      redirect?: 'if_required' | 'always';
    }): Promise<StripeConfirmResult>;
  }

  declare global {
    interface Window {
      Stripe?: (key: string) => StripeInstance;
    }
  }

  let stripeScriptPromise: Promise<void> | null = null;

  // -------------------------------------------------------------------
  // CONFIG & STORES — central keys/toggles + reactive app stores
  // -------------------------------------------------------------------
  const checkoutStore = useCheckoutStore();
  const cartStore = useCartStore();
  const { isOpen } = storeToRefs(checkoutStore);
  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, ''); // base Supabase URL
  const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();   // anon key (browser)
  const STRIPE_PUBLISHABLE_KEY = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim(); // Stripe client key
  const ORDER_PREVIEWS_BUCKET = (import.meta.env.VITE_SUPABASE_ORDER_PREVIEWS_BUCKET as string | undefined)?.trim() || 'order-previews'; // proof images
  const ORDER_DESIGNS_BUCKET = (import.meta.env.VITE_SUPABASE_ORDER_DESIGNS_BUCKET as string | undefined)?.trim() || 'order-design-assets'; // raw assets
  const FIREBASE_STORAGE_BUCKET = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined)?.trim() || 'firebase-storage';
  const BYPASS_PAYMENTS = String((import.meta.env.VITE_CHECKOUT_BYPASS_PAYMENTS as string | undefined) ?? '')
    .toLowerCase() === 'true'; // dev toggle: skip Stripe
  const TARGET_DESIGN_DPI = 300; // stamp PNG DPI for print

  const stripeConfigured = computed(() => Boolean(STRIPE_PUBLISHABLE_KEY) || BYPASS_PAYMENTS);

  // Stripe runtime handles + reactive flags for the payment step.
  const stripeInstance = ref<StripeInstance | null>(null);
  const stripeElements = ref<StripeElements | null>(null);
  const paymentElement = ref<StripePaymentElement | null>(null);
  const paymentElementRef = ref<HTMLDivElement | null>(null);
  const paymentIntentClientSecret = ref<string | null>(null);
  const paymentElementReady = ref(false);
  const paymentProcessing = ref(false);
  const paymentError = ref<string | null>(null);
  const orderRecording = ref(false); // true while recordOrderIfNeeded is executing
  const orderRecorded = ref(false);  // flips once we persist the Supabase row
  // In-flight upload cache: avoids re-uploading the same source multiple times within one checkout.
  const storageUploadCache = new Map<string, string>();

  // Debug switch for preview selection pipeline
  const DEBUG_PREVIEW_PIPELINE = false;

  type ExportPreviewVariantKey =
    | 'front-with-shirt'
    | 'front-without-shirt'
    | 'back-with-shirt'
    | 'back-without-shirt';

  const EXPORT_PREVIEW_LABELS: Record<ExportPreviewVariantKey, string> = {
    'front-with-shirt': 'Front · With shirt',
    'front-without-shirt': 'Front · Design only',
    'back-with-shirt': 'Back · With shirt',
    'back-without-shirt': 'Back · Design only',
  };

  type ExportPreviewItem = {
    cartItemId: string;
    itemLabel: string;
    variantLabel: string;
    quantity: number;
    previews: Array<{
      key: ExportPreviewVariantKey;
      label: string;
      url: string | null;
    }>;
  };

  // Modal state containing the preview cards shown before uploads occur.
  const exportPreviewOverlay = reactive({
    open: false,
    items: [] as ExportPreviewItem[],
  });

  type ExportPreviewUploads = {
    frontWithShirt?: string | null;
    frontWithoutShirt?: string | null;
    backWithShirt?: string | null;
    backWithoutShirt?: string | null;
  };

  type PreviewUploadSlotKey =
    | 'front-with-shirt'
    | 'front-without-shirt'
    | 'back-with-shirt'
    | 'back-without-shirt';

  type PreviewUploadSlotMeta = {
    suffix: string;
    fileBase: string;
    label: string;
    bucket: string;
    enforce: boolean;
    enforceWhenCandidates?: boolean;
    targetDpi?: number | null;
  };

  interface PreviewUploadRequest {
    slot: PreviewUploadSlotKey;
    cartItemId: string;
    orderItemId: string;
    bucket: string;
    pathSegments: string[];
    fallbackName: string;
    progressLabel: string;
    candidates: string[];
    targetDpi?: number | null;
    required: boolean;
  }

  interface PreviewUploadResult {
    slot: PreviewUploadSlotKey;
    url: string | null;
    bucket: string | null;
    request: PreviewUploadRequest;
    fallback?: boolean;
    error?: string | null;
  }

  type PreviewUploadResultMap = Record<PreviewUploadSlotKey, PreviewUploadResult>;

  const PREVIEW_UPLOAD_SLOT_CONFIG: Record<PreviewUploadSlotKey, PreviewUploadSlotMeta> = {
    'front-with-shirt': {
      suffix: 'front',
      fileBase: 'front',
      label: 'Front preview',
      bucket: ORDER_PREVIEWS_BUCKET,
      enforce: true,
      targetDpi: TARGET_DESIGN_DPI,
    },
    'back-with-shirt': {
      suffix: 'back',
      fileBase: 'back',
      label: 'Back preview',
      bucket: ORDER_PREVIEWS_BUCKET,
      enforce: true,
      targetDpi: TARGET_DESIGN_DPI,
    },
    'front-without-shirt': {
      suffix: 'front-blank',
      fileBase: 'front-blank',
      label: 'Front design-only',
      bucket: ORDER_PREVIEWS_BUCKET,
      enforce: false,
      enforceWhenCandidates: true,
      targetDpi: TARGET_DESIGN_DPI,
    },
    'back-without-shirt': {
      suffix: 'back-blank',
      fileBase: 'back-blank',
      label: 'Back design-only',
      bucket: ORDER_PREVIEWS_BUCKET,
      enforce: false,
      enforceWhenCandidates: true,
      targetDpi: TARGET_DESIGN_DPI,
    },
  };

  // Only upload design-only canvas renders; keep garment previews client-side.
  const UPLOAD_WITH_SHIRT_PREVIEWS = false;
  const PREVIEW_UPLOAD_SLOTS = Object.keys(PREVIEW_UPLOAD_SLOT_CONFIG) as PreviewUploadSlotKey[];
  const WITH_SHIRT_UPLOAD_SLOTS = new Set<PreviewUploadSlotKey>(['front-with-shirt', 'back-with-shirt']);

  function previewSlotEnabled(slot: PreviewUploadSlotKey): boolean {
    if (!UPLOAD_WITH_SHIRT_PREVIEWS && WITH_SHIRT_UPLOAD_SLOTS.has(slot)) {
      return false;
    }
    return true;
  }

  function getEnabledPreviewUploadSlots(): PreviewUploadSlotKey[] {
    return PREVIEW_UPLOAD_SLOTS.filter(previewSlotEnabled);
  }

  // Prefer cache refs & data URLs for uploads (cross-browser), blob last
  function buildUploadCandidates(item: CartItem, candidates: PreviewCandidateSet) {
    const usingLive = checkoutStore.editingCartItemId === item.id;

    const designCacheRefs = item.designPreviewCacheRefs ?? { Front: null, Back: null };
    const blankCacheRefs = item.blankDesignCacheRefs ?? { Front: null, Back: null };
    const designData = item.designPreviews ?? { Front: null, Back: null };
    const canvasData = item.canvasPreviews ?? { Front: null, Back: null };

    const liveWithFront = usingLive ? checkoutStore.designPreviews?.Front ?? null : null;
    const liveWithBack = usingLive ? checkoutStore.designPreviews?.Back ?? null : null;
    const liveBlankFront = usingLive ? checkoutStore.blankDesignPreviews?.Front ?? null : null;
    const liveBlankBack = usingLive ? checkoutStore.blankDesignPreviews?.Back ?? null : null;

    const uploadBuckets = {
      frontWithShirt: dedupePreviewList(
        preferNonBlobSources([
          designCacheRefs.Front,
          designData.Front ?? null,
          liveWithFront,
          ...candidates.frontWithShirt,
        ]),
      ),

      backWithShirt: dedupePreviewList(
        preferNonBlobSources([
          designCacheRefs.Back,
          designData.Back ?? null,
          liveWithBack,
          ...candidates.backWithShirt,
        ]),
      ),

      // Prefer fresh design-only renders (live + canvas + candidates),
      // and only fall back to any old blank cache ref at the very end.
      frontWithoutShirt: candidates.hasFrontDesign
        ? dedupePreviewList(
          preferNonBlobSources([
            liveBlankFront,
            canvasData.Front ?? null,
            ...candidates.frontWithoutShirt,
            blankCacheRefs.Front,
          ]),
        )
        : [],

      backWithoutShirt: candidates.hasBackDesign
        ? dedupePreviewList(
          preferNonBlobSources([
            liveBlankBack,
            canvasData.Back ?? null,
            ...candidates.backWithoutShirt,
            blankCacheRefs.Back,
          ]),
        )
        : [],
    };
    logPreviewBuckets('checkoutDrawer.buildUploadCandidates', uploadBuckets, {
      cartItemId: item.id,
      usingLive,
    });
    return uploadBuckets;
  }

  // Choose the best preview to show the user: prefer the freshly-uploaded URL, otherwise fall back to the first
  // viable candidate (data URL, cached blob, colour fallback).
  function resolveDisplaySource(
    candidates: string[] | null | undefined,
    uploaded: string | null | undefined = null,
    options?: { strict?: boolean },
  ): string | null {
    const strict = Boolean(options?.strict);
    if (typeof uploaded === 'string' && uploaded.trim().length > 0) {
      return uploaded.trim();
    }
    if (strict) return null;
    if (!Array.isArray(candidates)) return null;
    const normalized = candidates
      .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
      .filter((candidate) => candidate.length > 0);
    if (!normalized.length) return null;
    const displayable = normalized.find((candidate) => !candidate.startsWith('cache://'));
    return displayable ?? normalized[0];
  }

  function viewHasDesign(state: SerializedDesignState | null, view: DesignViewName): boolean {
    if (!state || !state.views) return false;
    const targetView = state.views[view];
    if (!targetView) return false;
    const images = Array.isArray(targetView.images) ? targetView.images : [];
    const texts = Array.isArray(targetView.texts) ? targetView.texts : [];
    return images.length > 0 || texts.length > 0;
  }

  type PreviewCandidateSet = {
    hasFrontDesign: boolean;
    hasBackDesign: boolean;
    frontWithShirt: string[];
    frontWithoutShirt: string[];
    backWithShirt: string[];
    backWithoutShirt: string[];
  };

  /**
   * Collect every possible preview source for a cart item.
   * We gather:
   * - WITH shirt candidates (garment renders, saved previews, colour imagery)
   * - Design-only candidates (ShirtPlacer blank renders, cached refs, print-only fallbacks)
   * Each list is ordered from “most accurate” to “least ideal” so later steps can pick intelligently.
   */
  function buildPreviewCandidates(item: CartItem): PreviewCandidateSet {
    const canvasSources = (item.canvasPreviews ?? { Front: null, Back: null }) as Record<PreviewView, string | null>;
    const previewCacheRefs = item.designPreviewCacheRefs ?? { Front: null, Back: null };
    const blankCacheRefs = item.blankDesignCacheRefs ?? { Front: null, Back: null };
    const designPreviews = item.designPreviews ?? { Front: null, Back: null };
    const frontPreviewStored = normalizePreview(designPreviews.Front);
    const backPreviewStored = normalizePreview(designPreviews.Back);
    const itemDesignState = (item.designState ?? null) as SerializedDesignState | null;
    const hasFrontDesign = viewHasDesign(itemDesignState, 'Front');
    const hasBackDesign = viewHasDesign(itemDesignState, 'Back');
    const usingLiveCheckoutPreviews = checkoutStore.editingCartItemId === item.id;
    const frontDesignCache = normalizePreview(previewCacheRefs.Front);
    const backDesignCache = normalizePreview(previewCacheRefs.Back);
    const liveFrontWithShirt = usingLiveCheckoutPreviews ? normalizePreview(checkoutStore.designPreviews?.Front) : null;
    const liveBackWithShirt = usingLiveCheckoutPreviews ? normalizePreview(checkoutStore.designPreviews?.Back) : null;
    const liveFrontBlank = usingLiveCheckoutPreviews ? normalizePreview(checkoutStore.blankDesignPreviews?.Front) : null;
    const liveBackBlank = usingLiveCheckoutPreviews ? normalizePreview(checkoutStore.blankDesignPreviews?.Back) : null;

    const frontBlankCache = normalizePreview(blankCacheRefs.Front);
    const backBlankCache = normalizePreview(blankCacheRefs.Back);

    // Slimmed: only the top 3 options, no garment/color fallbacks
    const frontWithShirt = dedupePreviewList(preferNonBlobSources([
      liveFrontWithShirt,
      frontDesignCache,
      frontPreviewStored,
    ]));

    const backWithShirt = dedupePreviewList(preferNonBlobSources([
      liveBackWithShirt,
      backDesignCache,
      backPreviewStored,
    ]));

    // Prefer hydrated blank, then canvas, then blank cache. No fallbacks.
    const frontWithoutShirt = hasFrontDesign
      ? dedupePreviewList(preferNonBlobSources([
        liveFrontBlank,
        canvasSources.Front,
        frontBlankCache,
      ]))
      : [];

    const backWithoutShirt = hasBackDesign
      ? dedupePreviewList(preferNonBlobSources([
        liveBackBlank,
        canvasSources.Back,
        backBlankCache,
      ]))
      : [];

    logPreviewBuckets('checkoutDrawer.buildPreviewCandidates', {
      frontWithShirt,
      backWithShirt,
      frontWithoutShirt,
      backWithoutShirt,
    }, {
      cartItemId: item.id,
      hasFrontDesign,
      hasBackDesign,
    });

    return {
      hasFrontDesign,
      hasBackDesign,
      frontWithShirt,
      frontWithoutShirt,
      backWithShirt,
      backWithoutShirt,
    };
  }

  /**
   * Convert the candidate/ upload info into the structure consumed by the overlay AND the Supabase payload.
   * We always include all four slots (front/back × with/without shirt) even if some are null so downstream
   * consumers can rely on consistent shapes.
   */
  function buildExportPreviewItem(
    item: CartItem,
    candidates: PreviewCandidateSet,
    uploads?: {
      frontWithShirt?: string | null;
      frontWithoutShirt?: string | null;
      backWithShirt?: string | null;
      backWithoutShirt?: string | null;
    } | null,
  ): ExportPreviewItem | null {
    const resolveOrWarn = (
      label: string,
      candidatesForView: string[],
      uploadedUrl: string | null | undefined,
    ): string | null => {
      if (typeof uploadedUrl === 'string' && uploadedUrl.trim().length) return uploadedUrl.trim();
      const fallback = resolveDisplaySource(candidatesForView, null);
      if (fallback) {
        console.warn(`[Checkout] ${label} preview missing uploaded URL; showing cached source instead.`, {
          fallback: describePreviewSource(fallback),
        });
      }
      return fallback;
    };

    const frontWithSource = previewSlotEnabled('front-with-shirt')
      ? resolveOrWarn('Front with shirt', candidates.frontWithShirt, uploads?.frontWithShirt)
      : resolveDisplaySource(candidates.frontWithShirt, null);
    const frontWithoutSource = resolveOrWarn('Front design-only', candidates.frontWithoutShirt, uploads?.frontWithoutShirt);
    const backWithSource = previewSlotEnabled('back-with-shirt')
      ? resolveOrWarn('Back with shirt', candidates.backWithShirt, uploads?.backWithShirt)
      : resolveDisplaySource(candidates.backWithShirt, null);
    const backWithoutSource = resolveOrWarn('Back design-only', candidates.backWithoutShirt, uploads?.backWithoutShirt);

    const previews = [
      { key: 'front-with-shirt' as const, label: EXPORT_PREVIEW_LABELS['front-with-shirt'], url: frontWithSource },
      { key: 'front-without-shirt' as const, label: EXPORT_PREVIEW_LABELS['front-without-shirt'], url: frontWithoutSource },
      { key: 'back-with-shirt' as const, label: EXPORT_PREVIEW_LABELS['back-with-shirt'], url: backWithSource },
      { key: 'back-without-shirt' as const, label: EXPORT_PREVIEW_LABELS['back-without-shirt'], url: backWithoutSource },
    ];
    if (!previews.some(p => p.url)) return null;

    return {
      cartItemId: item.id,
      itemLabel: item.product?.name ?? 'Custom apparel',
      variantLabel: cartItemVariantLabel(item),
      quantity: item.quantity,
      previews,
    };
  }

  function closeExportPreviewOverlay() {
    exportPreviewOverlay.open = false;
  }

  // --- Cart summaries (feeds step 1 UI + order snapshot) ---------------------
  const cartItems = computed(() => cartStore.items);
  const hasCartItems = computed(() => cartItems.value.length > 0);
  const cartItemCount = computed(() => cartStore.itemCount);

  function logCurrentUploadPlan(context: string) {
    const plan = buildUploadPlanEntries(cartItems.value);
    logUploadPlanTable(context, plan);
  }

  watch(isOpen, (open) => {
    if (open) {
      startProcessingIndicator();
      evaluateProcessingVariants();
      logCurrentUploadPlan('checkout-open');
    } else {
      finishProcessingIndicator();
    }
  });

  if (typeof window !== 'undefined') {
    window.__shirtlabLogUploadPlan = (context: string) => {
      logCurrentUploadPlan(context || 'manual');
    };
  }
  const cartSubtotalLabel = computed(() => {
    const total = cartStore.subtotal;
    if (!Number.isFinite(total) || total <= 0) return null;
    return formatCurrency(total, cartStore.firstCurrency);
  });
  const cartPricingDetails = computed(() => {
    const fallbackCurrency = cartStore.firstCurrency ?? 'USD';
    return cartItems.value.map((item) => {
      const breakdown = calculatePricing({
        basePrice: item.color?.price ?? null,
        designState: item.designState ?? null,
        designPreviews: item.designPreviews ?? { Front: null, Back: null },
        clothingDefinition: item.clothingDefinition ?? null,
        quantity: item.quantity,
      });
      const currency = item.currency ?? fallbackCurrency;
      return {
        item,
        breakdown,
        currency,
        formatted: {
          basePerUnit: formatCurrency(breakdown.basePrice, currency),
          designPerUnit: formatCurrency(breakdown.designChargeTotal, currency),
          discountPerUnit: breakdown.quantityDiscount
            ? formatCurrency(breakdown.quantityDiscount.amountPerUnit, currency)
            : null,
          unitPrice: formatCurrency(breakdown.finalUnitPrice, currency),
        },
      };
    });
  });
  const TAX_RATE = 0.06;
  const STRIPE_PERCENT = 0.029;
  const STRIPE_FIXED = 0.3;

  // Build export-preview entries for every cart item (used both for overlay rendering and order uploads).
  function buildExportPreviewItems(): ExportPreviewItem[] {
    const items = cartItems.value;
    const previewItems: ExportPreviewItem[] = [];
    for (const item of items) {
      const candidates = buildPreviewCandidates(item);
      const previewItem = buildExportPreviewItem(item, candidates, null);
      if (previewItem) {
        previewItems.push(previewItem);
      }
    }
    return previewItems;
  }

  // Refresh overlay state; `openOverlay` controls whether we toggle the modal or just refresh its data.
  function applyExportPreviewItems(openOverlay: boolean): ExportPreviewItem[] {
    const previewItems = buildExportPreviewItems();
    if (DEBUG_PREVIEW_PIPELINE) {
      console.log('[ExportPreview] items', previewItems);
    }
    exportPreviewOverlay.items.splice(0, exportPreviewOverlay.items.length, ...previewItems);
    if (openOverlay) {
      exportPreviewOverlay.open = previewItems.length > 0;
    } else if (exportPreviewOverlay.open && previewItems.length === 0) {
      exportPreviewOverlay.open = false;
    }
    return previewItems;
  }

  function openExportPreviewOverlay() {
    applyExportPreviewItems(true);
  }

  const cartPricingSummary = computed(() => {
    const details = cartPricingDetails.value;
    if (!details.length) {
      const currency = cartStore.firstCurrency ?? 'USD';
      return {
        baseTotal: 0,
        designTotal: 0,
        discountTotal: 0,
        finalTotal: 0,
        subtotal: 0,
        taxAmount: 0,
        stripeFees: 0,
        currency,
        baseLabel: formatCurrency(0, currency),
        designLabel: formatCurrency(0, currency),
        discountLabel: null,
        finalLabel: formatCurrency(0, currency),
        subtotalLabel: formatCurrency(0, currency),
        taxLabel: formatCurrency(0, currency),
        stripeFeeLabel: formatCurrency(0, currency),
        hasDiscount: false,
      };
    }
    let baseTotal = 0;
    let designTotal = 0;
    let discountTotal = 0;
    let finalTotal = 0;
    let currency = cartStore.firstCurrency ?? 'USD';
    details.forEach(({ item, breakdown, currency: itemCurrency }) => {
      const quantity = Math.max(1, Math.floor(item.quantity));
      baseTotal += breakdown.basePrice * quantity;
      designTotal += breakdown.designChargeTotal * quantity;
      finalTotal += breakdown.finalUnitPrice * quantity;
      if (breakdown.quantityDiscount) {
        discountTotal += breakdown.quantityDiscount.amountPerUnit * quantity;
      }
      if (itemCurrency) {
        currency = itemCurrency;
      }
    });
    const subtotal = baseTotal + designTotal;
    const taxAmount = Math.round(finalTotal * TAX_RATE * 100) / 100;
    const stripeFees = Math.round(((finalTotal + taxAmount) * STRIPE_PERCENT + STRIPE_FIXED) * 100) / 100;
    return {
      baseTotal,
      designTotal,
      discountTotal,
      finalTotal,
      subtotal,
      taxAmount,
      stripeFees,
      currency,
      baseLabel: formatCurrency(baseTotal, currency),
      designLabel: formatCurrency(designTotal, currency),
      discountLabel: discountTotal ? formatCurrency(Math.abs(discountTotal), currency) : null,
      finalLabel: formatCurrency(finalTotal, currency),
      subtotalLabel: formatCurrency(subtotal, currency),
      taxLabel: formatCurrency(taxAmount, currency),
      stripeFeeLabel: formatCurrency(stripeFees, currency),
      hasDiscount: discountTotal > 0,
    };
  });

  const activeCartItemId = ref<string | null>(null);
  const panelRef = ref<HTMLElement | null>(null);

  function designChargeLabel(charge: any): string {
    const view = charge?.view ?? 'View';
    if (charge?.elementType === 'composite') {
      const tier = charge?.category === 'full' ? 'Full coverage' : 'Partial coverage';
      return `${view} design area (${tier})`;
    }
    const typeMap: Record<string, string> = {
      text: 'Text',
      image: 'Graphic',
      icon: 'Icon',
      shape: 'Shape',
    };
    const elementLabel = typeMap[charge?.elementType] ?? 'Design';
    const index = typeof charge?.elementIndex === 'number' ? ` #${charge.elementIndex + 1}` : '';
    const category = charge?.category === 'full' ? 'Full coverage' : 'Partial coverage';
    return `${view} ${elementLabel}${index} (${category})`;
  }

  function designChargeMeta(charge: any): string | null {
    const parts: string[] = [];
    if (typeof charge?.widthInches === 'number' && typeof charge?.heightInches === 'number') {
      parts.push(`${charge.widthInches.toFixed(1)}″ × ${charge.heightInches.toFixed(1)}″`);
    }
    if (typeof charge?.areaSquareInches === 'number') {
      parts.push(`${charge.areaSquareInches.toFixed(1)} sq in`);
    }
    if (typeof charge?.coverageRatio === 'number') {
      parts.push(`${Math.round(charge.coverageRatio * 100)}% of grid`);
    }
    return parts.length ? parts.join(' · ') : null;
  }

  function designChargeItemsSummary(charge: any): string | null {
    if (!Array.isArray(charge?.items) || !charge.items.length) {
      return null;
    }
    const descriptors = charge.items.map((item: any) => {
      const typeLabelRaw = (item?.elementType ?? item?.type ?? 'design') as string;
      const typeLabel = typeLabelRaw ? `${typeLabelRaw.charAt(0).toUpperCase()}${typeLabelRaw.slice(1)}` : 'Design';
      const variantRaw = item?.elementVariant ?? '';
      const variant =
        typeof variantRaw === 'string' && variantRaw.includes(':')
          ? variantRaw.split(':').pop()
          : variantRaw;
      const label = item?.name && typeof item.name === 'string' && item.name.trim().length
        ? item.name.trim()
        : variant || typeLabel;
      const width = typeof item?.widthInches === 'number' ? item.widthInches : null;
      const height = typeof item?.heightInches === 'number' ? item.heightInches : null;
      const size = width !== null && height !== null
        ? `${width.toFixed(1)}″×${height.toFixed(1)}″`
        : null;
      const base = `${typeLabel} · ${label}`;
      return size ? `${base} (${size})` : base;
    });
    const count = charge.items.length;
    return `${count} item${count === 1 ? '' : 's'} — ${descriptors.join(', ')}`;
  }

  async function loadStripeScript(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (typeof window.Stripe === 'function') return;
    if (!stripeScriptPromise) {
      stripeScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Stripe.js'));
        document.head.appendChild(script);
      });
    }
    await stripeScriptPromise.catch((error) => {
      stripeScriptPromise = null;
      throw error;
    });
  }

  async function ensureStripe(): Promise<StripeInstance | null> {
    if (!STRIPE_PUBLISHABLE_KEY) return null;
    if (stripeInstance.value) return stripeInstance.value;
    await loadStripeScript();
    if (typeof window === 'undefined' || typeof window.Stripe !== 'function') {
      throw new Error('Stripe.js is unavailable.');
    }
    stripeInstance.value = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    return stripeInstance.value;
  }

  function unmountPaymentElement() {
    if (paymentElement.value) {
      try {
        paymentElement.value.unmount();
      } catch (error) {
        console.warn('[Checkout] Failed to unmount payment element', error);
      }
    }
    paymentElement.value = null;
  }

  function resetPaymentFlow() {
    paymentProcessing.value = false;
    paymentError.value = null;
    paymentElementReady.value = false;
    paymentIntentClientSecret.value = null;
    stripeElements.value = null;
    unmountPaymentElement();
  }

  function cloneSerializable<T>(value: T): T {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function inferFileExtension(contentType: string | null | undefined): string {
    if (!contentType) return 'png';
    const lower = contentType.toLowerCase();
    if (lower.includes('png')) return 'png';
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    if (lower.includes('webp')) return 'webp';
    if (lower.includes('svg')) return 'svg';
    return 'png';
  }

  function sanitizePathSegment(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  // UI feedback for long-running uploads (Supabase storage writes).
  const uploadProgress = reactive({
    active: false,
    current: 0,
    total: 0,
    label: '',
  });

  let uploadHideTimer: ReturnType<typeof setTimeout> | null = null;

  function resetUploadProgress() {
    if (uploadHideTimer) {
      clearTimeout(uploadHideTimer);
      uploadHideTimer = null;
    }
    uploadProgress.active = false;
    uploadProgress.current = 0;
    uploadProgress.total = 0;
    uploadProgress.label = '';
  }

  function scheduleUploadProgressHide() {
    if (uploadHideTimer) {
      clearTimeout(uploadHideTimer);
    }
    uploadHideTimer = setTimeout(resetUploadProgress, 1200);
  }

  const uploadProgressPercent = computed(() => {
    if (!uploadProgress.total) return 0;
    return Math.min(100, Math.round((uploadProgress.current / uploadProgress.total) * 100));
  });

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        resolve(result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to convert blob to data URL'));
      reader.readAsDataURL(blob);
    });
  }


  async function readBlobFromObjectUrl(url: string): Promise<Blob | null> {
    if (!url || !url.startsWith('blob:')) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('[Checkout] readBlobFromObjectUrl: fetch failed for blob URL', {
          url,
          status: response.status,
        });
        return null;
      }
      return await response.blob();
    } catch (error) {
      console.warn('[Checkout] Failed to read blob URL via fetch', url, error);
      return null;
    }
  }

  async function resolveSourceBlob(
    source: string | CachedAssetRef,
  ): Promise<{ blob: Blob; contentType: string | null } | null> {
    if (!source) return null;

    const normalizedSource = typeof source === 'string' ? source.trim() : String(source ?? '').trim();
    if (!normalizedSource) return null;

    if (isCachedAssetRef(normalizedSource)) {
      const cachedBlob = await getCachedBlob(normalizedSource);
      if (!cachedBlob) return null;
      return { blob: cachedBlob, contentType: cachedBlob.type || null };
    }

    if (normalizedSource.startsWith('data:')) {
      const blob = dataUrlToBlob(normalizedSource);
      return { blob, contentType: blob.type || null };
    }

    if (normalizedSource.startsWith('blob:')) {
      const cachedRef = resolveCachedRefFromObjectUrl(normalizedSource);
      if (cachedRef && isCachedAssetRef(cachedRef)) {
        const cachedBlob = await getCachedBlob(cachedRef);
        if (cachedBlob) {
          return { blob: cachedBlob, contentType: cachedBlob.type || null };
        }
      }
      const recovered = await readBlobFromObjectUrl(normalizedSource);
      if (recovered) {
        return { blob: recovered, contentType: recovered.type || null };
      }
      try {
        const response = await fetch(normalizedSource);
        if (!response.ok) throw new Error(`fetch blob failed ${response.status}`);
        const blob = await response.blob();
        const type = blob.type || response.headers.get('content-type') || null;
        return { blob, contentType: type };
      } catch (error) {
        console.warn('[Checkout] blob: not resolvable after fetch', normalizedSource, error);
        return null;
      }
    }

    try {
      const response = await fetch(normalizedSource);
      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || blob.type || null;
      return { blob, contentType };
    } catch (error) {
      console.warn('[Checkout] Failed to resolve source blob', { source: normalizedSource.slice(0, 120) }, error);
      return null;
    }
  }

  async function applyTargetDpiIfNeeded(
    blob: Blob,
    contentType: string | null,
    targetDpi: number | null,
  ): Promise<{ blob: Blob; contentType: string | null }> {
    if (!targetDpi) {
      return { blob, contentType: contentType ?? blob.type ?? null };
    }
    const type = (contentType ?? blob.type ?? '').toLowerCase();
    if (!type.includes('png')) {
      return { blob, contentType: contentType ?? blob.type ?? null };
    }
    const stampedBlob = await changeDpiBlob(blob, targetDpi);
    if (!stampedBlob) {
      return { blob, contentType: contentType ?? blob.type ?? null };
    }
    return { blob: stampedBlob, contentType: stampedBlob.type || contentType || blob.type || null };
  }

  type UploadImageOptions = {
    targetDpi?: number | null;
    allowSourceFallback?: boolean;
  };

  type StorageUploadPlanEntry = {
    service: 'supabase' | 'firebase';
    bucket: string;
    path: string;
    label: string;
  };

  function logStorageUploadPlan(plan: StorageUploadPlanEntry[], context: { source: string; cacheKey: string }) {
    if (!plan.length) return;
    try {
      console.groupCollapsed('[Checkout] Storage upload payload', {
        source: context.source,
        cacheKey: context.cacheKey,
      });
      console.table(
        plan.map((entry) => ({
          Service: entry.service,
          Bucket: entry.bucket,
          Path: entry.path,
          Label: entry.label,
        })),
      );
      console.groupEnd();
    } catch (error) {
      console.warn('[Checkout] Failed to log storage upload payload', error);
    }
  }

  /**
   * Upload a single preview/design source to Supabase storage.
   * Handles:
   *   - Resolving cache refs / blob URLs / data URLs / remote HTTP URLs
   *   - DPI stamping (print metadata)
   *   - Caching uploads within this session (storageUploadCache)
   *   - Falling back to the original URL when uploads are skipped (e.g. already public HTTP)
   */
  async function uploadImageSource(
    source: string,
    bucket: string,
    pathSegments: string[],
    fallbackName: string,
    progressLabel?: string,
    options?: UploadImageOptions,
  ): Promise<string | null> {
    const trimmedSource = (source || '').trim();
    if (!trimmedSource) return null;

    // Default to our print DPI
    const targetDpi = typeof options?.targetDpi === 'number' ? options.targetDpi : TARGET_DESIGN_DPI;

    const cacheKey = `${bucket}:${pathSegments.join('/')}:${trimmedSource}`;
    if (storageUploadCache.has(cacheKey)) {
      return storageUploadCache.get(cacheKey) ?? null;
    }

    const resolved = await resolveSourceBlob(trimmedSource);
    if (!resolved) {
      console.warn('[Checkout] Unable to resolve source for upload', { source: trimmedSource });
      return null;
    }

    // 🔼 KEY CHANGE: upscale ONLY for upload, not for UI.
    // Your live canvas is effectively 5× (RENDER_SCALE = 5), but the preview snapshots
    // are closer to 1× (~600px long side). Here we bump the upload blob so the
    // longest side is ~3000px, which matches that 5× scale.
    let uploadReadyBlob = resolved.blob;
    try {
      uploadReadyBlob = await upscalePngBlobForUpload(resolved.blob, 3000);
    } catch (error) {
      console.warn('[Checkout] upscalePngBlobForUpload failed, using original blob for upload', error);
    }

    // Then stamp DPI metadata (300) on the upscaled PNG
    const dpiAdjusted = await applyTargetDpiIfNeeded(uploadReadyBlob, resolved.contentType, targetDpi);

    const uploadedUrl = await uploadBlobToFirebase(
      bucket,
      dpiAdjusted.blob,
      fallbackName,
    );

    if (uploadedUrl) {
      storageUploadCache.set(cacheKey, uploadedUrl);
    }
    return uploadedUrl ?? null;
  }
  async function uploadFromCandidateSources(
    candidates: Array<string | null | undefined>,
    bucket: string,
    pathSegments: string[],
    fallbackName: string,
    progressLabel?: string,
    options?: UploadImageOptions,
  ): Promise<string | null> {
    if (!candidates.length) {
      console.warn('[Checkout] uploadFromCandidateSources called with no candidates', {
        bucket,
        pathSegments,
        fallbackName,
      });
      return null;
    }
    let attempt = 0;
    for (const candidate of candidates) {
      const normalized = normalizePreview(candidate);
      if (!normalized) continue;
      attempt += 1;
      console.log('[Checkout] uploadFromCandidateSources attempt', {
        fallbackName,
        attempt,
        total: candidates.length,
        source: describePreviewSource(normalized),
      });
      const result = await uploadImageSource(
        normalized,
        bucket,
        pathSegments,
        fallbackName,
        progressLabel,
        options,
      );
      if (result) {
        console.log('[Checkout] uploadFromCandidateSources success', {
          fallbackName,
          attempt,
          url: result,
        });
        return result; // ONLY Supabase URL from uploadImageSource
      }
    }
    console.warn('[Checkout] uploadFromCandidateSources exhausted all candidates without success', {
      fallbackName,
      attempts: attempt,
      bucket,
    });
    return null;
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) throw new Error('Invalid data URL');
    const header = dataUrl.slice(0, commaIndex);
    const dataPart = dataUrl.slice(commaIndex + 1);
    const headerMatch = header.match(/^data:([^;,]+)(.*)$/i);
    const mime = headerMatch ? headerMatch[1] : 'application/octet-stream';
    const isBase64 = /;base64/i.test(header);
    if (isBase64) {
      const binary = typeof atob === 'function' ? atob(dataPart) : Buffer.from(dataPart, 'base64').toString('binary');
      const length = binary.length;
      const buffer = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) buffer[i] = binary.charCodeAt(i);
      return new Blob([buffer], { type: mime });
    }
    let text: string;
    try {
      text = decodeURIComponent(dataPart);
    } catch {
      text = dataPart;
    }
    return new Blob([text], { type: mime });
  }

  type CollectedImageSource = {
    raw: string;
    original: string | null;
    cacheRef: string | null;
    uploadSource: string;
  };

  function collectDesignImageSources(designState: SerializedDesignState | null): CollectedImageSource[] {
    if (!designState || !designState.views) return [];
    const collected = new Map<string, CollectedImageSource>();
    for (const view of Object.values(designState.views)) {
      if (!view || !Array.isArray(view.images)) continue;
      for (const image of view.images) {
        const raw = typeof image?.imgUrl === 'string' ? image.imgUrl.trim() : '';
        const original = typeof image?.originalSource === 'string' ? image.originalSource.trim() : '';
        const cacheRef = typeof image?.assetCacheRef === 'string' ? image.assetCacheRef.trim() : '';
        const preferred = cacheRef || original || raw;
        if (!preferred) continue;
        const key = cacheRef || original || raw;
        if (!collected.has(key)) {
          collected.set(key, {
            raw,
            original: original || null,
            cacheRef: cacheRef || null,
            uploadSource: cacheRef || original || raw,
          });
        }
      }
    }
    return Array.from(collected.values());
  }

  type UploadPlanEntry = {
    item: CartItem;
    candidates: PreviewCandidateSet;
    uploads: ReturnType<typeof buildUploadCandidates>;
    designSources: CollectedImageSource[];
  };

  function buildUploadPlanEntries(items: CartItem[]): UploadPlanEntry[] {
    return items.map((item) => {
      const candidates = buildPreviewCandidates(item);
      const uploads = buildUploadCandidates(item, candidates);
      const designSources = collectDesignImageSources(item.designState);
      return {
        item,
        candidates,
        uploads,
        designSources,
      };
    });
  }

  function buildPreviewUploadRequests(
    orderToken: string,
    itemSlug: string,
    entry: UploadPlanEntry,
    orderItemId: string,
  ): PreviewUploadRequest[] {
    const slotSeeds: Record<PreviewUploadSlotKey, string[]> = {
      'front-with-shirt': entry.uploads.frontWithShirt.length
        ? entry.uploads.frontWithShirt
        : entry.candidates.frontWithShirt,
      'back-with-shirt': entry.uploads.backWithShirt.length
        ? entry.uploads.backWithShirt
        : entry.candidates.backWithShirt,
      'front-without-shirt': entry.uploads.frontWithoutShirt.length
        ? entry.uploads.frontWithoutShirt
        : entry.candidates.frontWithoutShirt,
      'back-without-shirt': entry.uploads.backWithoutShirt.length
        ? entry.uploads.backWithoutShirt
        : entry.candidates.backWithoutShirt,
    };

    const basePath = ['orders', orderToken, itemSlug];
    const slots = getEnabledPreviewUploadSlots();
    return slots.map((slot) => {
      const meta = PREVIEW_UPLOAD_SLOT_CONFIG[slot];
      const candidates = dedupePreviewList(slotSeeds[slot] ?? []);
      const required = meta.enforce || (meta.enforceWhenCandidates ? candidates.length > 0 : false);
      return {
        slot,
        cartItemId: entry.item.id,
        orderItemId,
        bucket: meta.bucket,
        pathSegments: [...basePath, meta.suffix],
        fallbackName: meta.fileBase,
        progressLabel: meta.label,
        candidates,
        targetDpi: meta.targetDpi,
        required,
      };
    });
  }

  function logPreviewUploadManifest(cartItemId: string, requests: PreviewUploadRequest[]) {
    try {
      console.groupCollapsed(`[PreviewUpload] manifest :: item=${cartItemId}`);
      console.table(
        requests.map((request) => ({
          Slot: request.slot,
          Required: request.required,
          Candidates: request.candidates.length,
          FirstCandidate: describePreviewSource(request.candidates[0] ?? null),
          Bucket: request.bucket,
          Path: request.pathSegments.join('/'),
        })),
      );
      console.groupEnd();
    } catch (error) {
      console.warn('[PreviewUpload] Failed to log manifest', { cartItemId }, error);
    }
  }

  async function executePreviewUploadRequests(requests: PreviewUploadRequest[]): Promise<PreviewUploadResultMap> {
    const resultMap = {} as PreviewUploadResultMap;
    for (const request of requests) {
      let uploadedUrl: string | null = null;
      let errorMessage: string | null = null;
      let usedFallback = false;
      if (!request.candidates.length) {
        console.warn('[PreviewUpload] No candidates available for slot', {
          slot: request.slot,
          cartItemId: request.cartItemId,
        });
      } else {
        try {
          uploadedUrl = await uploadFromCandidateSources(
            request.candidates,
            request.bucket,
            request.pathSegments,
            request.fallbackName,
            request.progressLabel,
            { targetDpi: request.targetDpi ?? TARGET_DESIGN_DPI },
          );
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[PreviewUpload] Upload threw', { slot: request.slot, cartItemId: request.cartItemId }, error);
        }
      }

      if (!uploadedUrl && request.required && request.candidates.length > 0) {
        const fallbackSource = request.candidates[0] ?? null;
        if (fallbackSource) {
          console.warn('[PreviewUpload] Falling back to original candidate', {
            slot: request.slot,
            cartItemId: request.cartItemId,
            source: describePreviewSource(fallbackSource),
          });
          uploadedUrl = fallbackSource;
          usedFallback = true;
        } else {
          throw new Error(
            `[PreviewUpload] ${request.progressLabel} failed after ${request.candidates.length} attempts for cart item ${request.cartItemId}.`,
          );
        }
      }

      resultMap[request.slot] = {
        slot: request.slot,
        url: uploadedUrl ?? null,
        bucket: uploadedUrl && !usedFallback ? request.bucket : null,
        request,
        fallback: usedFallback,
        error: errorMessage,
      };
    }
    return resultMap;
  }

  function logPreviewUploadResults(cartItemId: string, results: PreviewUploadResultMap) {
    try {
      console.groupCollapsed(`[PreviewUpload] results :: item=${cartItemId}`);
      console.table(
        getEnabledPreviewUploadSlots().map((slot) => {
          const result = results[slot];
          return {
            Slot: slot,
            Uploaded: describePreviewSource(result?.url ?? null),
            Required: result?.request.required ?? false,
            Candidates: result?.request.candidates.length ?? 0,
            Fallback: result?.fallback ?? false,
            Error: result?.error ?? '—',
          };
        }),
      );
      console.groupEnd();
    } catch (error) {
      console.warn('[PreviewUpload] Failed to log results', { cartItemId }, error);
    }
  }

  function mapPreviewUploadUrls(results: PreviewUploadResultMap): ExportPreviewUploads {
    return {
      frontWithShirt: previewSlotEnabled('front-with-shirt') ? results['front-with-shirt']?.url ?? null : null,
      frontWithoutShirt: results['front-without-shirt']?.url ?? null,
      backWithShirt: previewSlotEnabled('back-with-shirt') ? results['back-with-shirt']?.url ?? null : null,
      backWithoutShirt: results['back-without-shirt']?.url ?? null,
    };
  }

  function logUploadPlanTable(context: string, entries: UploadPlanEntry[]) {
    try {
      const rows = entries.map((entry, index) => ({
        Index: index + 1,
        CartItemId: entry.item.id,
        Product: entry.item.product?.name ?? 'Custom apparel',
        FrontWith: entry.uploads.frontWithShirt[0] ?? entry.candidates.frontWithShirt[0] ?? '—',
        FrontDesignOnly: entry.uploads.frontWithoutShirt[0] ?? entry.candidates.frontWithoutShirt[0] ?? '—',
        BackWith: entry.uploads.backWithShirt[0] ?? entry.candidates.backWithShirt[0] ?? '—',
        BackDesignOnly: entry.uploads.backWithoutShirt[0] ?? entry.candidates.backWithoutShirt[0] ?? '—',
        DesignElements: entry.designSources.length,
      }));
      console.group(`[CheckoutUploadPlan] ${context}`);
      console.table(rows);
      console.groupEnd();
    } catch (error) {
      console.warn('[Checkout] Failed to log upload plan', { context }, error);
    }
  }

  function createDesignPayloadSnapshot(): Array<{
    cartItemId: string;
    assets: Array<{ url: string; bucket: string | null; stored: boolean }> | null;
    elements: Array<Record<string, any>> | null;
  }> {
    const rawItemsSnapshot = cloneSerializable<CartItem[]>(cartItems.value);
    const uploadPlanEntries = buildUploadPlanEntries(rawItemsSnapshot);
    logUploadPlanTable('checkout-proceed', uploadPlanEntries);
    if (!rawItemsSnapshot.length) return [];
    type SnapshotAsset = { url: string; bucket: string | null; stored: boolean };
    type SnapshotEntry = {
      cartItemId: string;
      assets: SnapshotAsset[] | null;
      elements: Array<Record<string, any>> | null;
    };
    return rawItemsSnapshot
      .map((item) => {
        const designSources = collectDesignImageSources(item.designState ?? null);
        const assets: SnapshotAsset[] = designSources.map((source) => ({
          url: source.uploadSource,
          bucket: null,
          stored: Boolean(source.cacheRef),
        }));
        const elementEntries = buildDesignElements(item.designState ?? null, new Map<string, string>());
        if (!assets.length && !elementEntries.length) {
          return null;
        }
        return {
          cartItemId: item.id,
          assets: assets.length ? assets : null,
          elements: elementEntries.length ? elementEntries : null,
        };
      })
      .filter((entry): entry is SnapshotEntry => Boolean(entry));
  }

  function logDesignPayloadSnapshot(context: string) {
    try {
      const snapshot = createDesignPayloadSnapshot();
      if (!snapshot.length) {
        console.log(`[Checkout] Design payload preview (${context})`, []);
        return;
      }
      console.log(`[Checkout] Design payload preview (${context})`, snapshot);
    } catch (error) {
      console.warn(`[Checkout] Failed to log design payload preview (${context})`, error);
    }
  }

  function buildDesignElements(
    designState: SerializedDesignState | null,
    assetLookup: Map<string, string>,
  ): Array<Record<string, any>> {
    if (!designState || !designState.views) return [];
    const entries: Array<Record<string, any>> = [];
    for (const [viewName, view] of Object.entries(designState.views)) {
      const designView = viewName as DesignViewName;
      if (!view) continue;
      const images = Array.isArray(view.images) ? view.images : [];
      const texts = Array.isArray(view.texts) ? view.texts : [];

      for (const image of images) {
        const cacheRef = typeof (image as any)?.assetCacheRef === 'string' ? (image as any).assetCacheRef.trim() : '';
        const originalSrc = typeof (image as any)?.originalSource === 'string' ? (image as any).originalSource.trim() : '';
        const rawSrc = typeof image.imgUrl === 'string' ? image.imgUrl.trim() : '';
        let resolvedSource: string | null = null;
        const lookupOrder = [cacheRef, originalSrc, rawSrc].filter((key): key is string => Boolean(key));
        for (const key of lookupOrder) {
          const mapped = assetLookup.get(key);
          if (mapped) {
            resolvedSource = mapped;
            break;
          }
        }
        if (!resolvedSource) {
          resolvedSource = rawSrc || originalSrc || cacheRef || null;
        }
        entries.push({
          type: 'image',
          view: designView,
          id: image.id,
          name: image.name ?? null,
          isVector: Boolean(image.isVector),
          position: { x: image.x, y: image.y },
          size: { width: image.w, height: image.h },
          rotation: image.rotation,
          zIndex: image.z,
          aspect: image.aspect,
          shapeMeta: image.shapeMeta ?? null,
          source: resolvedSource,
        });
      }

      for (const text of texts) {
        entries.push({
          type: 'text',
          view: designView,
          id: text.id,
          content: text.content,
          font: text.font,
          color: text.color,
          outlineColor: text.outlineColor,
          outlineWidth: text.outlineWidth,
          size: text.size,
          alignment: text.alignment,
          position: { x: text.x, y: text.y },
          area: { width: text.w, height: text.h },
          rotation: text.rotation,
          zIndex: text.z,
          effect: text.effect ? cloneSerializable(text.effect) : null,
        });
      }
    }
    return entries;
  }

  function deriveAssetName(source: string, index: number): string {
    const base = source.startsWith('data:')
      ? `design-${index + 1}`
      : sanitizePathSegment(
        source.split('?')[0].split('/').pop()?.replace(/\.[^.]+$/, '') ?? '',
        `design-${index + 1}`,
      );
    return base || `design-${index + 1}`;
  }

  function splitCustomerName(fullName: string | null | undefined): { firstName: string; lastName: string } {
    const raw = typeof fullName === 'string' ? fullName.trim() : '';
    if (!raw) {
      return { firstName: 'Customer', lastName: 'Unknown' };
    }
    const parts = raw.split(/\s+/);
    const firstName = parts.shift() ?? 'Customer';
    const lastName = parts.length ? parts.join(' ') : firstName;
    return {
      firstName,
      lastName,
    };
  }

  function clearCheckoutQueryParam() {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('checkout')) return;
      url.searchParams.delete('checkout');
      window.history.replaceState(window.history.state, document.title, url.toString());
    } catch (error) {
      console.warn('[Checkout] Failed to clear checkout query param', error);
    }
  }

  /**
   * Core order writer.
   *  - Snapshot cart + customer state (so later UI mutations don’t affect the payload).
   *  - For each item, build preview candidates, upload missing assets, and collect metadata.
   *  - Insert the order row into Supabase (`orders` table) with items + design assets included.
   * Guarded by `orderRecording`/`orderRecorded` flags so the work runs once per checkout.
   */
  async function recordOrderIfNeeded() {
    if (orderRecording.value || orderRecorded.value) return;
    orderRecording.value = true;

    const customerSnapshot = cloneSerializable(checkoutStore.customer);
    const rawItemsSnapshot = cloneSerializable<CartItem[]>(cartItems.value);
    const orderToken = sanitizePathSegment(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, 'order');

    const uploadPlanEntries = buildUploadPlanEntries(rawItemsSnapshot);
    logUploadPlanTable('checkout-proceed', uploadPlanEntries);

    type DesignAssetRecord = {
      cartItemId: string;
      url: string;
      bucket: string | null;
      stored: boolean;
    };
    type DesignEntry = {
      cartItemId: string;
      assets: Array<{ url: string; bucket: string | null; stored: boolean }> | null;
      elements: Array<Record<string, any>> | null;
    };

    const orderItemsPayload: Array<{
      cartItemId: string;
      shirt: CartItem['product'] | null;
      color: CartItem['color'] | null;
      size: CartItem['size'];
      quantity: CartItem['quantity'];
      minimumQuantity: CartItem['minimumQuantity'];
      front_design_with_shirt_url: string | null;
      front_design_without_shirt_url: string | null;
      back_design_with_shirt_url: string | null;
      back_design_without_shirt_url: string | null;
    }> = [];

    const designAssets: DesignAssetRecord[] = [];
    const assetUrlLookup = new Map<string, string>();
    const orderItemIdCache = new Map<string, string>();
    const usedOrderItemIds = new Set<string>();
    const previewOverlayItems: ExportPreviewItem[] = [];

    const resolveOrderItemId = (item: CartItem): string => {
      const existing = orderItemIdCache.get(item.id);
      if (existing) return existing;
      let candidate: string;
      do {
        candidate = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      } while (usedOrderItemIds.has(candidate));
      orderItemIdCache.set(item.id, candidate);
      usedOrderItemIds.add(candidate);
      return candidate;
    };

    const DESIGN_VIEWS: DesignViewName[] = ['Front', 'Back'];

    const registerPreviewAsset = (params: { cartItemId: string; url: string | null; bucket: string | null }) => {
      const { cartItemId, url, bucket } = params;
      if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('cache://')) return;
      designAssets.push({
        cartItemId,
        url,
        bucket: bucket ?? null,
        stored: true,
      });
    };

    for (const [index, planEntry] of uploadPlanEntries.entries()) {
      const item = planEntry.item;
      const orderItemId = resolveOrderItemId(item);
      const itemSlug = sanitizePathSegment(item?.id ?? `item-${index + 1}`, `item-${index + 1}`);

      const uploadRequests = buildPreviewUploadRequests(orderToken, itemSlug, planEntry, orderItemId);
      logPreviewUploadManifest(item.id, uploadRequests);
      const slotResults = await executePreviewUploadRequests(uploadRequests);
      logPreviewUploadResults(item.id, slotResults);
      Object.values(slotResults).forEach((result) => {
        if (result?.url && result.bucket) {
          registerPreviewAsset({
            cartItemId: orderItemId,
            url: result.url,
            bucket: result.bucket,
          });
        }
      });

      const uploadUrls = mapPreviewUploadUrls(slotResults);
      const frontWithUrlFinal = uploadUrls.frontWithShirt ?? null;
      const backWithUrlFinal = uploadUrls.backWithShirt ?? null;
      const frontWithoutUrlFinal = uploadUrls.frontWithoutShirt ?? null;
      const backWithoutUrlFinal = uploadUrls.backWithoutShirt ?? null;

      orderItemsPayload.push({
        cartItemId: orderItemId,
        shirt: item.product ?? null,
        color: item.color ?? null,
        size: item.size ?? null,
        quantity: item.quantity,
        minimumQuantity: item.minimumQuantity,
        front_design_with_shirt_url: frontWithUrlFinal,
        front_design_without_shirt_url: frontWithoutUrlFinal,
        back_design_with_shirt_url: backWithUrlFinal,
        back_design_without_shirt_url: backWithoutUrlFinal,

      });

      const previewItem = buildExportPreviewItem(item, planEntry.candidates, {
        frontWithShirt: uploadUrls.frontWithShirt ?? null,
        frontWithoutShirt: uploadUrls.frontWithoutShirt ?? null,
        backWithShirt: uploadUrls.backWithShirt ?? null,
        backWithoutShirt: uploadUrls.backWithoutShirt ?? null,
      });
      if (previewItem) previewOverlayItems.push(previewItem);

      // Upload underlying design assets — uploads only, never keep external URLs
      const uploadedSources = planEntry.designSources;
      const totalDesignUploads = uploadedSources.length;
      for (const [sourceIndex, sourceInfo] of uploadedSources.entries()) {
        const uploadSource = sourceInfo.cacheRef ?? sourceInfo.original ?? sourceInfo.raw;
        if (!uploadSource) continue;
        const assetKeyForName = sourceInfo.original ?? sourceInfo.raw ?? uploadSource;
        const assetName = deriveAssetName(assetKeyForName, sourceIndex);

        if (totalDesignUploads > 0) {
          const designName = assetName || `design-${sourceIndex + 1}`;
          console.info(`[Checkout] Uploading design element ${sourceIndex + 1} of ${totalDesignUploads}`, {
            cartItemId: item.id,
            name: designName,
          });
        }

        const uploadedDesign = await uploadImageSource(
          uploadSource,
          ORDER_DESIGNS_BUCKET,
          ['orders', orderToken, itemSlug, assetName],
          assetName,
          `Design asset ${sourceIndex + 1}`,
          { targetDpi: TARGET_DESIGN_DPI },
        );

        const finalUrl = uploadedDesign ?? null;
        if (finalUrl) {
          console.info('[Checkout] Design element upload complete', {
            cartItemId: item.id,
            url: finalUrl,
            name: assetName || `design-${sourceIndex + 1}`,
          });
        }

        if (finalUrl && !finalUrl.startsWith('data:') && !finalUrl.startsWith('blob:') && !finalUrl.startsWith('cache://')) {
          const stored = Boolean(uploadedDesign && uploadedDesign !== uploadSource);
          designAssets.push({
            cartItemId: orderItemId,
            url: finalUrl,
            bucket: stored ? (ORDER_DESIGNS_BUCKET || null) : null,
            stored,
          });
          const lookupKeys = [uploadSource, sourceInfo.raw, sourceInfo.original, sourceInfo.cacheRef]
            .filter((key): key is string => typeof key === 'string' && key.trim().length > 0);
          for (const key of lookupKeys) assetUrlLookup.set(key, finalUrl);
        }
      }

      const canvasPreviewSources = item.canvasPreviews ?? { Front: null, Back: null };
      const canvasPreviewCacheRefs = item.canvasPreviewCacheRefs ?? { Front: null, Back: null };
      const blankPreviewSources = item.blankPreviews ?? { Front: null, Back: null };

      for (const view of DESIGN_VIEWS) {
        const viewLabel = view === 'Front' ? 'Front' : 'Back';
        const candidates = dedupePreviewList(
          preferNonBlobSources([
            canvasPreviewCacheRefs[view],
            canvasPreviewSources[view],
            blankPreviewSources[view],
          ]),
        );
        if (!candidates.length) continue;
        const canvasName = `${view.toLowerCase()}-canvas`;
        console.info(`[Checkout] Uploading ${viewLabel} canvas`, {
          cartItemId: item.id,
          candidates: candidates.length,
          name: canvasName,
        });
        const uploadedCanvas = await uploadFromCandidateSources(
          candidates,
          ORDER_DESIGNS_BUCKET,
          ['orders', orderToken, itemSlug, `${view.toLowerCase()}-canvas`],
          `${view.toLowerCase()}-canvas`,
          `${viewLabel} canvas`,
          { targetDpi: TARGET_DESIGN_DPI },
        );
        if (!uploadedCanvas) continue;
        console.info('[Checkout] Canvas upload complete', {
          cartItemId: item.id,
          name: canvasName,
          url: uploadedCanvas,
        });
        const canvasStored = !uploadedCanvas.startsWith('data:') &&
          !uploadedCanvas.startsWith('blob:') &&
          !uploadedCanvas.startsWith('cache://');
        if (canvasStored) {
          designAssets.push({
            cartItemId: orderItemId,
            url: uploadedCanvas,
            bucket: ORDER_DESIGNS_BUCKET || null,
            stored: true,
          });
        }
        for (const candidate of candidates) {
          if (typeof candidate === 'string' && candidate.trim().length > 0) {
            assetUrlLookup.set(candidate, uploadedCanvas);
          }
        }
      }
    }

    exportPreviewOverlay.items.splice(0, exportPreviewOverlay.items.length, ...previewOverlayItems);
    exportPreviewOverlay.open = previewOverlayItems.length > 0;

    const designEntries: DesignEntry[] = rawItemsSnapshot
      .map((item) => {
        const orderItemId = ((): string => {
          const existing = orderItemIdCache.get(item.id);
          if (existing) return existing;
          let candidate: string;
          do {
            candidate = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
          } while (usedOrderItemIds.has(candidate));
          orderItemIdCache.set(item.id, candidate);
          usedOrderItemIds.add(candidate);
          return candidate;
        })();

        const assetEntries = designAssets
          .filter((asset) => asset.cartItemId === orderItemId)
          .map((asset) => ({
            url: asset.url,
            bucket: asset.bucket,
            stored: asset.stored,
          }));

        const elementEntries = buildDesignElements(item.designState, assetUrlLookup);
        if (!assetEntries.length && !elementEntries.length) return null;

        return {
          cartItemId: orderItemId,
          assets: assetEntries.length ? assetEntries : null,
          elements: elementEntries.length ? elementEntries : null,
        };
      })
      .filter((entry): entry is DesignEntry => Boolean(entry));

    console.info('[Checkout] Design payload summary', {
      items: designEntries.length,
      assets: designAssets.length,
      elements: designEntries.reduce((total, entry) => total + (entry.elements?.length ?? 0), 0),
    });

    const { firstName, lastName } = splitCustomerName(customerSnapshot.fullName);
    const email = typeof customerSnapshot.email === 'string' && customerSnapshot.email.trim()
      ? customerSnapshot.email.trim()
      : 'unknown@example.com';
    const phone = typeof customerSnapshot.phone === 'string' && customerSnapshot.phone.trim()
      ? customerSnapshot.phone.trim()
      : 'Not provided';
    const company = typeof customerSnapshot.company === 'string' && customerSnapshot.company.trim()
      ? customerSnapshot.company.trim()
      : null;
    const orderDetails = typeof customerSnapshot.notes === 'string' && customerSnapshot.notes.trim()
      ? customerSnapshot.notes.trim()
      : null;
    const orderTotal = Number.isFinite(cartStore.subtotal)
      ? Math.round((cartStore.subtotal as number) * 100) / 100
      : null;

    try {
      resetUploadProgress();
      console.log('[Checkout] Supabase order payload (uploads only, no external links)', { designs: designEntries });
      const { error } = await supabase.from('orders').insert([{
        first_name: firstName,
        last_name: lastName,
        company,
        phone,
        items: orderItemsPayload.length ? orderItemsPayload : null,
        designs: designEntries.length ? designEntries : null,
        order_details: orderDetails,
        email,
        payment_status: true,
        order_total: orderTotal,
        status: 'pending',
      }]);
      if (error) throw error;

      orderRecorded.value = true;
      clearCheckoutQueryParam();
    } catch (error) {
      console.error('[Checkout] Failed to record order in Supabase', error);
    } finally {
      orderRecording.value = false;
      scheduleUploadProgressHide();
    }
  }

  async function setupPaymentElement(clientSecret: string) {
    const stripe = await ensureStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured. Missing publishable key.');
    }

    unmountPaymentElement();
    paymentElementReady.value = false;

    stripeElements.value = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'flat',
        variables: {
          colorPrimary: '#2563eb',
          colorBackground: '#ffffff',
          colorText: '#0f172a',
          borderRadius: '14px',
        },
      },
    });

    if (!stripeElements.value) {
      throw new Error('Failed to initialize Stripe Elements.');
    }

    paymentElement.value = stripeElements.value.create('payment', {
      layout: 'tabs',
    });

    await nextTick();
    const mountTarget = paymentElementRef.value;
    if (!mountTarget) {
      throw new Error('Payment element mount point is not available.');
    }

    paymentElement.value.mount(mountTarget);
    paymentElementReady.value = true;
  }

  async function confirmPayment() {
    const stripe = stripeInstance.value ?? await ensureStripe();
    if (!stripe || !stripeElements.value) {
      paymentError.value = 'Secure payment form is not ready yet.';
      return;
    }
    paymentProcessing.value = true;
    paymentError.value = null;
    requestStatus.value = 'processing';

    const successUrl = new URL(window.location.href);
    successUrl.searchParams.set('checkout', 'success');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements: stripeElements.value,
      confirmParams: {
        return_url: successUrl.toString(),
      },
      redirect: 'if_required',
    });

    if (error) {
      paymentProcessing.value = false;
      paymentError.value = error.message ?? 'Payment could not be completed.';
      requestStatus.value = 'error';
      return;
    }

    if (paymentIntent && (paymentIntent.status === 'processing' || paymentIntent.status === 'requires_action')) {
      requestStatus.value = 'processing';
      paymentProcessing.value = false;
      return;
    }

    requestStatus.value = 'success';
    paymentProcessing.value = false;
    recordOrderIfNeeded();
  }

  type Step = 1 | 2 | 3;
  const currentStep = ref<Step>(1);
  const step1Complete = ref(false);
  const step2Complete = ref(false);
  const requestStatus = ref<'idle' | 'processing' | 'success' | 'canceled' | 'error'>('idle');
  const step3Complete = computed(() => requestStatus.value === 'success');

  const canGoBack = computed(() => {
    if (currentStep.value === 2) return true;
    if (currentStep.value === 3) return requestStatus.value !== 'processing' && requestStatus.value !== 'success';
    return false;
  });

  function goBack() {
    if (!canGoBack.value) return;
    if (currentStep.value === 3) {
      // Return to contact details to edit before resubmitting
      requestStatus.value = 'idle';
      currentStep.value = 2;
      return;
    }
    if (currentStep.value === 2) {
      currentStep.value = 1;
    }
  }
  // Preview UI state: which view (Front/Back) + whether we show design-only or garment renders.
  const previewView = ref<PreviewView>('Front');
  watch(cartItems, (items) => {
    if (!items.length) {
      activeCartItemId.value = null;
      previewView.value = 'Front';
      resetPaymentFlow();
      checkoutStore.finishEditingCartItem();
      return;
    }
    const current = items.find((item) => item.id === activeCartItemId.value) ?? items[0];
    focusCartItem(current);
  }, { immediate: true });

  const activeCartItem = computed<CartItem | null>(() => {
    if (!cartItems.value.length) return null;
    const existing = cartItems.value.find((item) => item.id === activeCartItemId.value);
    return existing ?? cartItems.value[0];
  });

  const previewViews = ['Front', 'Back'] as const;
  type PreviewView = typeof previewViews[number];
  const viewLabels: Record<PreviewView, string> = {
    Front: 'Front',
    Back: 'Back',
  };


  function describeUploadSource(source: string): string {
    const trimmed = source.trim().toLowerCase();
    if (trimmed.startsWith('data:')) return 'data-url';
    if (trimmed.startsWith('blob:')) return 'blob-url';
    if (trimmed.startsWith('cache://')) return 'cache-ref';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'remote-url';
    return 'local';
  }

  function resolvePreviewSources(item: CartItem | null): Record<PreviewView, string | null> {
    if (!item) {
      return { Front: null, Back: null };
    }
    const designPreviews = item.designPreviews ?? { Front: null, Back: null };
    const color = item.color;
    const frontFallback = normalizePreview(item.previewImage)
      ?? normalizePreview(color?.frontUrl)
      ?? normalizePreview(color?.sideUrl);
    const backFallback = normalizePreview(color?.backUrl)
      ?? normalizePreview(color?.frontUrl)
      ?? normalizePreview(color?.sideUrl)
      ?? frontFallback;
    return {
      Front: normalizePreview(designPreviews.Front) ?? frontFallback ?? null,
      Back: normalizePreview(designPreviews.Back) ?? backFallback ?? null,
    };
  }

  function resolveBlankPreviewSources(item: CartItem | null): Record<PreviewView, string | null> {
    if (!item) {
      return { Front: null, Back: null };
    }
    const blanks = item.blankPreviews ?? { Front: null, Back: null };
    return {
      Front: normalizePreview(blanks.Front),
      Back: normalizePreview(blanks.Back),
    };
  }

  // When editing the active cart item, prefer live previews from checkoutStore
  const editingActiveItem = computed(() =>
    Boolean(checkoutStore.isEditingCartItem && checkoutStore.editingCartItemId === activeCartItemId.value)
  );

  const previewSources = computed(() => {
    const item = activeCartItem.value;
    if (!item) return { Front: null, Back: null } as Record<PreviewView, string | null>;
    if (editingActiveItem.value) {
      const live = checkoutStore.designPreviews ?? { Front: null, Back: null } as Record<PreviewView, string | null>;
      const color = item.color;
      const frontFallback = normalizePreview(item.previewImage)
        ?? normalizePreview(color?.frontUrl)
        ?? normalizePreview(color?.sideUrl);
      const backFallback = normalizePreview(color?.backUrl)
        ?? normalizePreview(color?.frontUrl)
        ?? normalizePreview(color?.sideUrl)
        ?? frontFallback;
      return {
        Front: normalizePreview(live.Front) ?? normalizePreview(item.designPreviews?.Front) ?? frontFallback ?? null,
        Back: normalizePreview(live.Back) ?? normalizePreview(item.designPreviews?.Back) ?? backFallback ?? null,
      };
    }
    return resolvePreviewSources(item);
  });

  // New: blankPreviewSources prefers hydrated blank previews (from store) and falls back to canvas/item blanks
  const blankPreviewSources = computed(() => {
    const item = activeCartItem.value;
    if (!item) return { Front: null, Back: null } as Record<PreviewView, string | null>;
    if (editingActiveItem.value) {
      const liveBlank = (checkoutStore.blankDesignPreviews ?? { Front: null, Back: null }) as Record<PreviewView, string | null>;
      const liveCanvas = (checkoutStore.canvasPreviews ?? { Front: null, Back: null }) as Record<PreviewView, string | null>;
      return {
        Front:
          normalizePreview(liveBlank.Front) ??
          normalizePreview(liveCanvas.Front) ??
          normalizePreview(item.blankPreviews?.Front) ??
          normalizePreview(item.canvasPreviews?.Front) ??
          null,
        Back:
          normalizePreview(liveBlank.Back) ??
          normalizePreview(liveCanvas.Back) ??
          normalizePreview(item.blankPreviews?.Back) ??
          normalizePreview(item.canvasPreviews?.Back) ??
          null,
      };
    }
    return resolveBlankPreviewSources(item);
  });

  function evaluateProcessingVariants() {
    markProcessingVariant('withFront', previewSources.value.Front);
    markProcessingVariant('withBack', previewSources.value.Back);
    markProcessingVariant('withoutFront', blankPreviewSources.value.Front);
    markProcessingVariant('withoutBack', blankPreviewSources.value.Back);
  }

  const showDesignOnly = ref(false);
  const previewAvailability = computed<Record<PreviewView, boolean>>(() => ({
    Front: showDesignOnly.value
      ? Boolean(blankPreviewSources.value.Front)
      : Boolean(previewSources.value.Front),
    Back: showDesignOnly.value
      ? Boolean(blankPreviewSources.value.Back)
      : Boolean(previewSources.value.Back),
  }));
  const hasDesignOnlyAny = computed(() => Boolean(blankPreviewSources.value.Front || blankPreviewSources.value.Back));
  const rawActivePreviewSrc = computed(() => {
    const view = previewView.value;
    if (showDesignOnly.value) {
      return blankPreviewSources.value[view] ?? null;
    }
    return previewSources.value[view] ?? null;
  });

  const activePreviewSrc = ref<string | null>(null);
  // Local object URL created from inline data/legacy sources; revoked on change/unmount.
  let localPreviewObjectUrl: string | null = null;

  function setLocalPreviewObjectUrl(url: string | null) {
    if (localPreviewObjectUrl) {
      try {
        URL.revokeObjectURL(localPreviewObjectUrl);
      } catch {
        // ignore
      }
      localPreviewObjectUrl = null;
    }
    activePreviewSrc.value = url;
    if (url && url.startsWith('blob:')) {
      localPreviewObjectUrl = url;
    }
  }

  // Normalize preview sources so the <img> always uses blob URLs (when possible),
  // rehydrated from cache or inline data each time.
  watch(
    rawActivePreviewSrc,
    async (value) => {
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized) {
        setLocalPreviewObjectUrl(null);
        return;
      }

      // For standard HTTP/HTTPS, use as-is.
      if (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://')
      ) {
        activePreviewSrc.value = normalized;
        return;
      }

      // If we have a cache ref, resolve it to a blob URL for display.
      if (isCachedAssetRef(normalized)) {
        try {
          const objectUrl = await touchCachedObjectUrl(normalized);
          activePreviewSrc.value = objectUrl ?? null;
        } catch (error) {
          console.warn('[Checkout] Failed to resolve cached preview for display', normalized, error);
          setLocalPreviewObjectUrl(null);
        }
        return;
      }

      // Inline data URL: convert to blob and create an object URL.
      if (normalized.startsWith('data:')) {
        try {
          const blob = dataUrlToBlob(normalized);
          const url = URL.createObjectURL(blob);
          setLocalPreviewObjectUrl(url);
        } catch (error) {
          console.warn('[Checkout] Failed to convert data URL preview to blob', error);
          setLocalPreviewObjectUrl(null);
        }
        return;
      }

      // If we have a blob URL, try to map it back to a cache ref and resolve that.
      if (normalized.startsWith('blob:')) {
        try {
          const cachedRef = resolveCachedRefFromObjectUrl(normalized);
          if (cachedRef && isCachedAssetRef(cachedRef)) {
            const objectUrl = await touchCachedObjectUrl(cachedRef);
            if (objectUrl) {
              activePreviewSrc.value = objectUrl;
              return;
            }
          }
        } catch (error) {
          console.warn('[Checkout] Failed to resolve blob preview for display', normalized, error);
        }
        // Fallback: keep the existing blob URL.
        activePreviewSrc.value = normalized;
        return;
      }

      // Any other schemes are not displayable.
      setLocalPreviewObjectUrl(null);
    },
    { immediate: true },
  );

  function determineInitialPreviewView(item: CartItem | null): PreviewView {
    const sources = resolvePreviewSources(item);
    if (sources.Front) return 'Front';
    if (sources.Back) return 'Back';
    return 'Front';
  }

  watch(previewSources, (sources) => {
    if (!sources[previewView.value]) {
      const fallback = previewViews.find((view) => sources[view]) ?? 'Front';
      previewView.value = fallback;
    }
  }, { immediate: true });

  watch(() => previewSources.value.Front, (value) => {
    markProcessingVariant('withFront', value);
  });
  watch(() => previewSources.value.Back, (value) => {
    markProcessingVariant('withBack', value);
  });
  watch(() => blankPreviewSources.value.Front, (value) => {
    markProcessingVariant('withoutFront', value);
  });
  watch(() => blankPreviewSources.value.Back, (value) => {
    markProcessingVariant('withoutBack', value);
  });

  // Keep the overlay in sync with live edits. When any preview/canvas state changes while the modal is open,
  // rebuild its data so the user always sees the latest renders before uploading.
  watch(
    [
      cartItems,
      () => checkoutStore.designPreviews,
      () => checkoutStore.blankDesignPreviews,
      () => checkoutStore.canvasPreviews,
      () => checkoutStore.designPreviewCacheRefs,
      () => checkoutStore.blankDesignCacheRefs,
    ],
    () => {
      if (exportPreviewOverlay.open) {
        applyExportPreviewItems(false);
      }
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    if (localPreviewObjectUrl) {
      try {
        URL.revokeObjectURL(localPreviewObjectUrl);
      } catch {
        // ignore
      }
      localPreviewObjectUrl = null;
    }
  });

  function proceedToContact() {
    if (!hasCartItems.value) return;
    step1Complete.value = true;
    currentStep.value = 2;
  }



  function incrementCartItemQuantity(item: CartItem) {
    cartStore.setItemQuantity(item.id, item.quantity + 1);
  }

  function decrementCartItemQuantity(item: CartItem) {
    if (item.quantity <= item.minimumQuantity) {
      cartStore.removeItem(item.id);
      return;
    }
    cartStore.setItemQuantity(item.id, item.quantity - 1);
  }

  function removeCartItem(id: string) {
    cartStore.removeItem(id);
  }

  function focusCartItem(item: CartItem) {
    activeCartItemId.value = item.id;
    checkoutStore.beginEditingCartItem(item);
    previewView.value = determineInitialPreviewView(item);
  }

  function selectCartItem(item: CartItem) {
    focusCartItem(item);
  }

  function setPreviewView(view: PreviewView) {
    if (!previewAvailability.value[view]) return;
    previewView.value = view;
  }

  function handleAddNewItem() {
    checkoutStore.finishEditingCartItem();
    resetPaymentFlow();
    checkoutStore.setOpen(false);
    nextTick(() => {
      window.dispatchEvent(new CustomEvent('shirtlab:open-clothing-picker'));
    });
  }

  function cartItemVariantLabel(item: CartItem): string {
    const colorLabel = item.color?.name ?? 'Color TBD';
    const sizeLabel = item.size ?? 'Size TBD';
    return `${colorLabel} · ${sizeLabel}`;
  }

  watch(isOpen, (open) => {
    if (!open) return;
    logDesignPayloadSnapshot('drawer-opened');
  });

  const fullNameField = computed({
    get: () => checkoutStore.customer.fullName,
    set: (value: string) => checkoutStore.updateCustomerField('fullName', value),
  });

  const emailField = computed({
    get: () => checkoutStore.customer.email,
    set: (value: string) => checkoutStore.updateCustomerField('email', value),
  });

  const phoneField = computed({
    get: () => checkoutStore.customer.phone,
    set: (value: string) => checkoutStore.updateCustomerField('phone', value),
  });

  const companyField = computed({
    get: () => checkoutStore.customer.company,
    set: (value: string) => checkoutStore.updateCustomerField('company', value),
  });

  const notesField = computed({
    get: () => checkoutStore.customer.notes,
    set: (value: string) => checkoutStore.updateCustomerField('notes', value),
  });

  const submitting = ref(false);
  const checkoutError = ref<string | null>(null);

  async function submit() {
    if (!hasCartItems.value) {
      close();
      return;
    }
    const pricedItems = cartItems.value.filter((item) => Number.isFinite(item.unitPrice) && item.unitPrice !== null);
    if (!pricedItems.length) {
      checkoutError.value = 'Add at least one priced item before checking out.';
      return;
    }
    if (!SUPABASE_URL) {
      checkoutError.value = 'Checkout service is not configured. Missing VITE_SUPABASE_URL.';
      return;
    }
    if (!SUPABASE_ANON_KEY) {
      checkoutError.value = 'Checkout service is not configured. Missing VITE_SUPABASE_ANON_KEY.';
      return;
    }
    if (!stripeConfigured.value) {
      checkoutError.value = 'Payment service is not configured. Missing Stripe publishable key.';
      return;
    }

    resetPaymentFlow();

    step2Complete.value = true;
    requestStatus.value = 'idle';
    submitting.value = true;
    checkoutError.value = null;
    logCurrentUploadPlan('checkout-proceed-click');
    try {
      if (typeof window !== 'undefined') {
        const generator = window.__shirtlabGenerateHighResPreviews;
        if (typeof generator === 'function') {
          await generator();
        }
      }
      const lineItems = pricedItems.map((item) => {
        const rawUnit = Math.round((item.unitPrice as number) * 100);
        if (!Number.isFinite(rawUnit) || rawUnit <= 0) {
          throw new Error('One of the items has an invalid price.');
        }
        const quantity = Math.max(1, Math.floor(item.quantity));
        return {
          id: item.id,
          quantity,
          unitAmount: rawUnit,
          currency: (item.currency ?? cartStore.firstCurrency ?? 'USD').toLowerCase(),
          name: item.product?.name ?? 'Custom Apparel',
          description: cartItemVariantLabel(item),
          image: item.previewImage ?? undefined,
          metadata: {
            productId: item.product?.id ?? null,
            colorId: item.color?.id ?? null,
            size: item.size ?? null,
            cartItemId: item.id,
            minimumQuantity: item.minimumQuantity,
            designId: item.designId ?? null,
          },
        };
      });

      const successUrl = new URL(window.location.href);
      successUrl.searchParams.set('checkout', 'success');
      const cancelUrl = new URL(window.location.href);
      cancelUrl.searchParams.set('checkout', 'canceled');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          mode: 'payment-intent',
          lineItems,
          customer: {
            name: checkoutStore.customer.fullName || null,
            email: checkoutStore.customer.email || null,
            phone: checkoutStore.customer.phone || null,
            company: checkoutStore.customer.company || null,
            notes: checkoutStore.customer.notes || null,
          },
          cartSummary: {
            subtotal: cartStore.subtotal,
            currency: cartStore.firstCurrency ?? 'USD',
            itemCount: cartStore.itemCount,
            uniqueCount: cartStore.uniqueCount,
          },
          metadata: {
            activeItemId: activeCartItem.value?.id ?? null,
          },
          successUrl: successUrl.toString(),
          cancelUrl: cancelUrl.toString(),
          bypass: BYPASS_PAYMENTS,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to start payment. Please try again.');
      }
      if (data?.bypassed) {
        currentStep.value = 3;
        requestStatus.value = 'success';
        paymentIntentClientSecret.value = null;
        paymentError.value = null;
        paymentProcessing.value = false;
        await recordOrderIfNeeded();
        return;
      }
      if (!data?.clientSecret) {
        throw new Error('Payment could not be initialised. Missing client secret.');
      }
      paymentIntentClientSecret.value = data.clientSecret as string;
      currentStep.value = 3;
      paymentError.value = null;
      await nextTick();
      await setupPaymentElement(data.clientSecret as string);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to start payment. Please try again.';
      checkoutError.value = message;
      console.error('[Checkout] Payment intent error', error);
      requestStatus.value = 'error';
      currentStep.value = 2;
    } finally {
      submitting.value = false;
    }
  }

  const paymentFormReady = computed(() => paymentElementReady.value && Boolean(paymentIntentClientSecret.value));

  function resetSteps() {
    currentStep.value = 1;
    step1Complete.value = false;
    step2Complete.value = false;
    requestStatus.value = 'idle';
    resetPaymentFlow();
  }

  function hydrateFromQuery() {
    const url = new URL(window.location.href);
    const state = url.searchParams.get('checkout');
    if (state === 'success') {
      step1Complete.value = true;
      step2Complete.value = true;
      requestStatus.value = 'success';
      currentStep.value = 3;
      recordOrderIfNeeded();
    } else if (state === 'canceled') {
      step1Complete.value = true;
      step2Complete.value = true;
      requestStatus.value = 'canceled';
      currentStep.value = 2;
    }
  }

  function close() {
    resetPaymentFlow();
    checkoutStore.cancelEditingCartItem();
    if (requestStatus.value === 'success') {
      cartStore.clear();
    }
    exportPreviewOverlay.open = false;
    checkoutStore.setOpen(false);
  }

  onBeforeUnmount(() => {
    unmountPaymentElement();
  });

  watch(isOpen, (value) => {
    if (!value) {
      checkoutStore.cancelEditingCartItem();
      resetPaymentFlow();
      exportPreviewOverlay.open = false;
      return;
    }
    nextTick(() => {
      resetSteps();
      hydrateFromQuery();
      panelRef.value?.focus();
    });
  });

  watch(() => requestStatus.value, (status) => {
    if (status === 'success') {
      recordOrderIfNeeded();
    } else if (status === 'idle') {
      orderRecorded.value = false;
    }
  });

  watch(cartItems, (items) => {
    if (!items.length) {
      orderRecorded.value = false;
    }
  }, { deep: true });
</script>

<style scoped lang="scss">

  .checkout-overlay-fade-enter-active,
  .checkout-overlay-fade-leave-active {
    transition: opacity 0.25s ease;
  }

  .checkout-overlay-fade-enter-from,
  .checkout-overlay-fade-leave-to {
    opacity: 0;
  }

  .processing-overlay-fade-enter-active,
  .processing-overlay-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .processing-overlay-fade-enter-from,
  .processing-overlay-fade-leave-to {
    opacity: 0;
  }

  .checkout-overlay {
    position: absolute;
    inset: 0;
    z-index: 4500;
    display: flex;
    justify-content: center;
    align-items: center;

    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(6px);
    overflow: hidden;
  }

  .checkout-overlay__container {
    height: 100%;
    width: 100%;
    background: #fff;
    box-shadow: 0 45px 80px rgba(15, 23, 42, 0.34);

    display: flex;
    flex-direction: column;

    color: #0f172a;
  }

  .checkout-overlay__panel {
    padding: clamp(1.5rem, 3vw, 2.5rem);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    flex: 1 1 auto;

  }

  .checkout-shell__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .checkout-upload-progress {
    margin: 0.5rem 0 1rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .checkout-upload-progress__label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #1d4ed8;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .checkout-upload-progress__bar {
    position: relative;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.18);
    overflow: hidden;
  }

  .checkout-upload-progress__fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #2563eb, #38bdf8);
    transition: width 0.2s ease;
  }

  .checkout-shell__intro {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .checkout-shell__intro h2 {
    margin: 0;
    font-size: clamp(1.6rem, 2.6vw, 2rem);
    font-weight: 600;
  }

  .checkout-shell__intro p {
    margin: 0;
    font-size: 0.94rem;
    color: #475569;
  }

  .checkout-shell__eyebrow {
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #38bdf8;
    font-weight: 600;
  }

  .checkout-shell__close {
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #38bdf8;
    font-weight: 600;
    cursor: pointer;
  }

  .checkout-shell__actions {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
  }

  .checkout-shell__back {
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #38bdf8;
    font-weight: 600;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .checkout-shell__back[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
  }


  .checkout-shell__progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    padding: 0.75rem 1.1rem;
    justify-content: space-between;
    list-style: none;
    background: linear-gradient(120deg, rgba(226, 232, 240, 0.45), rgba(248, 250, 252, 0.8));
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.22);
  }

  .checkout-shell__progress-step {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .checkout-shell__progress-step .step-index {
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.25);
    border: 1px solid rgba(148, 163, 184, 0.35);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
  }

  .checkout-shell__progress-step.is-active {
    color: #0f172a;
  }

  .checkout-shell__progress-step.is-active .step-index {
    background: #38bdf8;
    border-color: #38bdf8;
    color: #0f172a;
  }

  .checkout-shell__progress-step.is-complete {
    color: #16a34a;
  }

  .checkout-shell__progress-step.is-complete .step-index {
    background: #bbf7d0;
    border-color: #16a34a;
    color: #166534;
  }

  .checkout-shell__content {
    flex: 1;
    height: 5rem;
    overflow: scroll;
  }

  .checkout-shell__footer {
    border-top: 1px solid rgba(148, 163, 184, 0.18);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.85), #fff);
    display: flex;
    position: relative;
    z-index: 1;
    padding: 0.5rem;
    flex-shrink: 0;

  }

  .checkout-shell__footer-actions {

    width: 100%;
    display: flex;
    justify-content: space-between;

    .details {
      display: flex;
      gap: 2rem;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      text-align: center;

      div {
        display: flex;
        flex-direction: column;
      }
    }
  }

  .checkout-shell__grid {
    display: grid;

    gap: clamp(1.5rem, 3vw, 2.25rem);
    align-items: start;
  }

  .checkout-shell__main {
    display: flex;
    flex-direction: row;
    width: auto;
    gap: 1rem;
    height: auto;
  }

  .checkout-shell__aside {
    display: flex;
    flex-direction: row;
    width: auto;
    gap: 1rem;
  }

  .checkout-preview {
    display: flex;
    width: 15rem;
    flex-direction: column;
    gap: 1.1rem;
    background: #fff;
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    padding: clamp(1.1rem, 2.8vw, 1.6rem);
    box-shadow: 0 20px 36px rgba(15, 23, 42, 0.12);
  }

  .checkout-preview__header h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-preview__variant {
    margin: 0.3rem 0 0;
    font-size: 0.87rem;
    color: #475569;
  }

  .checkout-preview__viewer {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.75rem;
    align-items: stretch;
  }

  .checkout-preview__controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .checkout-preview__control {
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(226, 232, 240, 0.35);
    color: #0f172a;
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }

  .checkout-preview__control:hover:not(:disabled) {
    background: rgba(226, 232, 240, 0.55);
  }

  .checkout-preview__control:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkout-preview__control.active {
    background: rgba(59, 130, 246, 0.18);
    border-color: rgba(59, 130, 246, 0.45);
    color: #1d4ed8;
  }

  .checkout-preview__frame {
    position: relative;
    border-radius: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(226, 232, 240, 0.2);
    height: 5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .checkout-preview__frame.has-image {
    background: #fff;
  }

  .checkout-preview__frame img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .checkout-preview__empty {
    font-size: 0.9rem;
    color: #64748b;
    text-align: center;
    padding: 1rem;
  }

  .checkout-preview__meta {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    margin: 0;
  }

  .checkout-preview__meta div {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .checkout-preview__meta dt {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
    font-weight: 600;
  }

  .checkout-preview__meta dd {
    margin: 0;
    font-size: 0.9rem;
    color: #0f172a;
    font-weight: 500;
  }

  .checkout-preview__hint {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .checkout-payment {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .checkout-payment__element {
    position: relative;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 1.2rem;
    padding: clamp(1rem, 2.2vw, 1.4rem);
    background: rgba(248, 250, 252, 0.85);
    min-height: 140px;
    display: flex;
    align-items: center;
  }

  .checkout-payment__element.is-loading {
    background: rgba(248, 250, 252, 0.6);
  }

  .checkout-payment__mount {
    width: 100%;
  }

  .checkout-payment__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    color: #64748b;
    pointer-events: none;
  }

  .checkout-payment__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .checkout-form__secondary {
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: transparent;
    color: #1e293b;
    border-radius: 999px;
    padding: 0.65rem 1.6rem;
    font-size: 0.88rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .checkout-form__secondary:hover:not(:disabled) {
    background: rgba(226, 232, 240, 0.45);
  }

  .checkout-form__secondary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .checkout-payment__error,
  .checkout-payment__success {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .checkout-payment__error p,
  .checkout-payment__success p {
    margin: 0;
    font-size: 0.95rem;
    color: #475569;
  }

  .checkout-feature {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr);
    gap: clamp(1.1rem, 2vw, 1.5rem);
    background: linear-gradient(135deg, rgba(236, 252, 203, 0.85), rgba(196, 240, 194, 0.7));
    border-radius: 1.5rem;
    border: 1px solid rgba(148, 201, 64, 0.38);
    padding: clamp(1.25rem, 3vw, 1.75rem);
    box-shadow: 0 28px 48px rgba(120, 162, 85, 0.24);
  }

  .checkout-feature__media {
    position: relative;
    border-radius: 1.25rem;
    background: rgba(148, 201, 64, 0.18);
    border: 1px solid rgba(148, 201, 64, 0.4);
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    overflow: hidden;
  }

  .checkout-feature__media.has-image {
    background: #fff;
    border-color: rgba(15, 23, 42, 0.08);
  }

  .checkout-feature__media img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .checkout-feature__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .checkout-feature__title h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .checkout-feature__title p {
    margin: 0.35rem 0 0;
    font-size: 0.95rem;
    color: #475569;
  }

  .checkout-feature__stats {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    margin: 0;
  }

  .checkout-feature__stats>div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-right: 0.35rem;
  }

  .checkout-feature__stats dt {
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #0f172a;
    font-weight: 600;
  }

  .checkout-feature__stats dd {
    margin: 0;
    font-size: 0.95rem;
    color: #1e293b;
  }

  .checkout-feature__quantity {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .checkout-feature__quantity span {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f172a;
    font-weight: 600;
  }

  .checkout-quantity-control {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #fff;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
  }

  .checkout-quantity-control button {
    border: none;
    background: rgba(148, 163, 184, 0.18);
    border-radius: 999px;
    width: 2.1rem;
    height: 2.1rem;
    font-size: 1.2rem;
    line-height: 1;
    color: #0f172a;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
  }

  .checkout-quantity-control button:hover {
    background: rgba(148, 163, 184, 0.26);
    transform: translateY(-1px);
  }

  .checkout-quantity-control input {
    width: 3.25rem;
    border: none;
    background: transparent;
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-quantity-control input:focus {
    outline: none;
  }

  .checkout-feature__measurements {
    padding: 1rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkout-feature__measurements h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-feature__measurements dl {
    margin: 0;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .checkout-feature__measurements dt {
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
  }

  .checkout-feature__measurements dd {
    margin: 0.1rem 0 0;
    font-size: 0.92rem;
    color: #0f172a;
  }

  .checkout-card__header {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    text-align: left;

    margin-bottom: 1rem;
  }

  .checkout-card__header span {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .checkout-card__header p {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  .checkout-card__header div {
    display: flex;
    width: 100%;
    justify-content: space-between;
  }

  .checkout-cart {
    background: #f8fafc;
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    padding: clamp(1.1rem, 2.8vw, 1.6rem);

    flex-grow: 1;
  }



  .checkout-cart__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    max-height: 320px;
    overflow-y: auto;
    padding-right: 0.4rem;
  }

  .checkout-cart__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem;
    border-radius: 1rem;
    border: 1px solid transparent;
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }

  .checkout-cart__item:hover {
    border-color: rgba(59, 130, 246, 0.25);
    background: rgba(226, 232, 240, 0.45);
  }

  .checkout-cart__item.active {
    border-color: rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.1);
    box-shadow: 0 12px 22px rgba(59, 130, 246, 0.2);
  }

  .checkout-cart__item--new {
    padding: 0.85rem;
    justify-content: center;
    border: 1.5px dashed rgba(148, 163, 184, 0.65);
    background: rgba(226, 232, 240, 0.35);
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }

  .checkout-cart__item--new:hover {
    border-color: rgba(59, 130, 246, 0.6);
    background: rgba(59, 130, 246, 0.12);
    box-shadow: 0 14px 24px rgba(59, 130, 246, 0.14);
  }

  .checkout-cart__add {
    width: 100%;
    border: none;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    padding: 0.5rem;
    cursor: pointer;
    color: #0f172a;
    text-align: center;
  }

  .checkout-cart__add:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 3px;
  }

  .checkout-cart__add-icon {
    width: 3.2rem;
    height: 3.2rem;
    border-radius: 999px;
    background: #38bdf8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #0f172a;
    box-shadow: 0 12px 22px rgba(56, 189, 248, 0.25);
    transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
  }

  .checkout-cart__item--new:hover .checkout-cart__add-icon {
    transform: translateY(-2px);
    background: #0ea5e9;
    color: #f8fafc;
  }

  .checkout-cart__add-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .checkout-cart__select {
    flex: 1;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75rem;
    align-items: center;
    border: none;
    background: transparent;
    text-align: left;
    padding: 0;
    cursor: pointer;
  }

  .checkout-cart__thumb {
    width: 5rem;
    height: 5rem;
    border-radius: 0.9rem;
    background: rgba(226, 232, 240, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: #475569;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    overflow: hidden;
  }

  .checkout-cart__thumb.has-image {
    background: #fff;
    border-color: rgba(15, 23, 42, 0.08);
  }

  .checkout-cart__thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .checkout-cart__copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .checkout-cart__copy .title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-cart__copy .variant {
    font-size: 0.84rem;
    color: #475569;
  }

  .checkout-cart__copy .qty {
    font-size: 0.75rem;
    color: #64748b;
  }

  .checkout-cart__actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .checkout-cart__actions button {
    border: none;
    background: rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    padding: 0.4rem 0.7rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #0f172a;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .checkout-cart__actions button:hover {
    background: rgba(148, 163, 184, 0.3);
  }

  .checkout-cart__actions .remove {
    background: rgba(248, 113, 113, 0.2);
    color: #b91c1c;
  }

  .checkout-cart__actions .remove:hover {
    background: rgba(248, 113, 113, 0.3);
  }


  .checkout-summary .eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 600;
  }

  .checkout-summary h3 {
    margin: 0.25rem 0 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-summary dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .checkout-summary dl>div {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .checkout-summary dt {
    font-size: 0.85rem;
    color: #475569;
  }

  .checkout-summary dd {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-form-card {
    background: #fff;




    overflow: scroll;
    margin-bottom: -1rem;
  }

  .checkout-form-card-striper {
    background: #fff;



    overflow: scroll;
    margin-bottom: -1rem;
  }

  .checkout-form {
    display: flex;

    gap: 1.4rem;
  }

  .checkout-form__grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .checkout-form__grid label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 600;
  }

  .checkout-form__grid input,
  .checkout-form__grid textarea {
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 0.9rem;
    padding: 0.7rem 0.9rem;
    font-size: 0.96rem;
    color: #0f172a;
    background: #fff;
    box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.08);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .checkout-form__grid input:focus,
  .checkout-form__grid textarea:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.55);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
  }

  .checkout-form__grid textarea {
    resize: vertical;
    min-height: 120px;
  }

  .checkout-form__notes {
    grid-column: 1 / -1;
  }


  .checkout-form__error {
    margin: 0;
    padding: 0.75rem 1rem;
    border-radius: 0.9rem;
    background: rgba(248, 113, 113, 0.14);
    color: #b91c1c;
    font-size: 0.85rem;
  }

  .checkout-form__submit {
    align-self: flex-end;
    padding: 0.8rem 1.85rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 800;
    box-sizing: border-box;

    border-radius: 10px;
    border: none;
    cursor: pointer;
    color: rgb(255, 255, 255);
    height: 100%;
    background: linear-gradient(135deg, rgb(206, 245, 135), #8e2);
    transition: transform 0.2s ease, box-shadow 0.25s ease, opacity 0.2s ease;
    box-sizing: border-box;
  }

  .checkout-form__submit:disabled {
    cursor: default;
    box-shadow: none;
    opacity: 0;
  }

  .checkout-form__submit:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 30px 55px rgba(135, 253, 45, 0.4);
  }

  .checkout-form__secondary {
    align-self: flex-end;
    padding: 0.7rem 1.4rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    border-radius: 999px;
    border: 1px solid rgba(30, 64, 175, 0.25);
    background: rgba(59, 130, 246, 0.08);
    color: #1d4ed8;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    margin-right: auto;
  }

  .checkout-form__secondary:hover {
    transform: translateY(-1px);
    background: rgba(59, 130, 246, 0.16);
    box-shadow: 0 10px 26px rgba(59, 130, 246, 0.2);
  }

  .checkout-form__secondary:active {
    transform: translateY(0);
  }

  .checkout-overlay__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 1rem;
    text-align: center;
  }

  .checkout-overlay__empty p {
    margin: 0;
    font-size: 1.05rem;
    color: #475569;
  }

  .checkout-overlay__empty button {
    border: none;
    background: rgba(148, 163, 184, 0.2);
    color: #0f172a;
    padding: 0.6rem 1.3rem;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
  }

  .checkout-overlay__empty button:hover {
    background: rgba(148, 163, 184, 0.3);
    transform: translateY(-1px);
  }

  .checkout-summary {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
    border-radius: 1.25rem;


    transition: all 0.3s ease;
  }


  .checkout-summary__section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkout-summary__item,
  .checkout-summary__discount,
  .checkout-summary__total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.95rem;
    color: #1e293b;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .checkout-summary__item span {
    color: #64748b;
    font-weight: 500;
  }

  .checkout-summary__item strong {
    color: #0f172a;
    font-weight: 600;
  }

  .checkout-summary__discount {
    color: #16a34a;
    font-weight: 600;
  }

  .checkout-summary__discount span {
    color: #22c55e;
  }

  .checkout-summary__total {
    border-top: 2px solid rgba(148, 163, 184, 0.25);
    border-bottom: none;
    padding-top: 0.75rem;
    font-weight: 700;
    font-size: 1.15rem;
    color: #0f172a;
  }

  .summary-taxes {
    gap: 0.6rem;
  }

  .summary-tax span {
    color: #475569;
    font-weight: 500;
  }

  .summary-tax strong {
    color: #0f172a;
  }

  .summary-item__info {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    max-width: 65%;
  }

  .summary-item__title {
    color: #0f172a;
    font-weight: 600;
    text-align: left;
  }

  .summary-item__charges {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .summary-item__charges li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .summary-item__charges li strong {
    color: #0f172a;
    font-weight: 600;
  }

  .summary-item__charges li small {
    display: block;
    font-size: 0.72rem;
    color: rgba(71, 85, 105, 0.85);
  }

  .summary-item__total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
  }

  .summary-item__total strong {
    font-size: 1rem;
    color: #0f172a;
  }

  .summary-item__total small {
    font-size: 0.75rem;
    color: #64748b;
  }


  .checkout-summary__total span {
    color: #38bdf8;
  }

  @media (max-width: 1024px) {
    .checkout-overlay__container {
      max-height: calc(100% - clamp(1.5rem, 6vw, 3.5rem));
    }

    .checkout-shell__grid {
      grid-template-columns: 1fr;
    }

    .checkout-shell__aside {
      position: relative;
      top: 0;
    }

    .checkout-cart__list {
      max-height: none;
    }
  }

  @media (max-width: 720px) {
    .checkout-overlay {
      padding: clamp(0.75rem, 4vw, 1.5rem);
    }

    .checkout-overlay__container {
      border-radius: 1.35rem;
    }

    .checkout-overlay__panel {
      padding: 1.1rem;
      gap: 1.25rem;
    }

    .checkout-shell__header h2 {
      font-size: 1.45rem;
    }

    .checkout-shell__progress {
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .checkout-feature {
      grid-template-columns: 1fr;
    }

    .checkout-feature__media {
      width: 100%;
      max-width: 280px;
      margin: 0 auto;
    }

    .checkout-card__header {
      flex-direction: column;
    }

    .checkout-form__grid {
      grid-template-columns: 1fr;
    }

    .checkout-form__submit {
      align-self: stretch;
    }
  }

  .export-preview-fade-enter-active,
  .export-preview-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .export-preview-fade-enter-from,
  .export-preview-fade-leave-to {
    opacity: 0;
  }

  .export-preview-overlay {
    position: fixed;
    inset: 0;
    backdrop-filter: blur(12px);
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(1rem, 4vw, 2rem);
    z-index: 120000;
  }

  .export-preview-overlay__panel {
    width: min(1040px, 94vw);
    max-height: min(90vh, 720px);
    background: #fff;
    border-radius: 1.5rem;
    box-shadow: 0 32px 64px rgba(15, 23, 42, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .export-preview-overlay__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 1.5rem 2rem 1.25rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .export-preview-overlay__header h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    color: #0f172a;
  }

  .export-preview-overlay__header p {
    margin: 0.35rem 0 0;
    font-size: 0.92rem;
    color: #475569;
  }

  .export-preview-overlay__close {
    border: none;
    background: #0f172a;
    color: #fff;
    border-radius: 999px;
    padding: 0.5rem 1.2rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.2s ease;
  }

  .export-preview-overlay__close:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.18);
  }

  .export-preview-overlay__close:active {
    transform: translateY(0);
  }

  .export-preview-overlay__content {
    padding: 1.75rem 2rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .export-preview-item {
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 1.25rem;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, rgba(241, 245, 249, 0.65), rgba(255, 255, 255, 0.85));
  }

  .export-preview-item__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .export-preview-item__header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #0f172a;
  }

  .export-preview-item__header span {
    font-size: 0.85rem;
    color: #475569;
  }

  .export-preview-item__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
  }

  .export-preview-card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: center;
    text-align: center;
  }

  .export-preview-card__image {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 0.9rem;
    background: rgba(248, 250, 252, 0.8);
    box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .export-preview-card__image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .export-preview-card__placeholder {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .export-preview-card figcaption {
    font-size: 0.82rem;
    color: #0f172a;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .export-preview-overlay__panel {
      width: 95vw;
      max-height: 92vh;
    }

    .export-preview-overlay__header,
    .export-preview-overlay__content {
      padding: 1.25rem 1.25rem;
    }
  }
</style>
const registerPreviewAsset = (params: { cartItemId: string; url: string | null; bucket: string | null }) => {
const { cartItemId, url, bucket } = params;
if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('cache://')) return;
designAssets.push({
cartItemId,
url,
bucket: bucket ?? null,
stored: true,
});
};
