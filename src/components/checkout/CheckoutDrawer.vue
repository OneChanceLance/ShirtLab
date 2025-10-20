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
              <span>Send request</span>
            </li>
          </ul>

          <div v-if="hasCartItems">
            <div class="checkout-shell__content">
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
                    <div class="checkout-preview__frame" :class="{ 'has-image': Boolean(activePreviewSrc) }">
                      <img v-if="activePreviewSrc" :src="activePreviewSrc"
                        :alt="`${viewLabels[previewView]} view of ${activeCartItem?.product?.name ?? 'selected item'}`" />
                      <div v-else class="checkout-preview__empty">
                        Select an item to see its preview
                      </div>
                      <div class="checkout-preview__controls">
                        <button v-for="view in previewViews" :key="view" type="button" class="checkout-preview__control"
                          :class="{ active: previewView === view }" :disabled="!previewAvailability[view]"
                          :aria-pressed="previewView === view" @click="setPreviewView(view)">
                          {{ viewLabels[view] }}
                        </button>
                      </div>
                    </div>
                  </section>
                </main>


                <section v-if="currentStep === 2" class="checkout-form-card">

                  <form class="checkout-form" @submit.prevent="submit">
                    <div class="checkout-form__grid">
                      <label>
                        <span>Full name</span>
                        <input type="text" v-model="fullNameField" placeholder="Alex Taylor" />
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
                        })($event)" placeholder="(555) 123-4567" />
                      </label>
                      <label>
                        <span>Company</span>
                        <input type="text" v-model="companyField" placeholder="Your company" />
                      </label>
                      <label class="checkout-form__notes">
                        <span>Order notes</span>
                        <textarea rows="4" v-model="notesField"
                          placeholder="Share artwork details, deadlines, and special requests"></textarea>
                      </label>
                    </div>
                    <div class="checkout-form__summary">
                      <div>
                        <span>Total items</span>
                        <strong>{{ cartItemCount }}</strong>
                      </div>
                      <div>
                        <span>Subtotal</span>
                        <strong>{{ cartSubtotalLabel ?? '—' }}</strong>
                      </div>
                    </div>
                    <p v-if="checkoutError" class="checkout-form__error">
                      {{ checkoutError }}
                    </p>
                    <button type="submit" class="checkout-form__submit" :disabled="submitting">
                      {{ submitting ? 'Submitting…' : 'Submit Order' }}
                    </button>
                  </form>
                </section>
                <section v-if="currentStep === 3" class="checkout-form-card">
                  <header class="checkout-card__header">
                    <div>
                      <h3>Send request</h3>
                      <p v-if="requestStatus === 'processing'">Redirecting to complete your order…</p>
                      <p v-else-if="requestStatus === 'success'">Request sent! We’ll follow up by email.</p>
                      <p v-else-if="requestStatus === 'canceled'">Checkout canceled. You can go back and edit details.
                      </p>
                      <p v-else-if="requestStatus === 'error'">Something went wrong. Please try again.</p>
                    </div>
                  </header>
                  <div v-if="requestStatus === 'canceled' || requestStatus === 'error'"
                    style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button type="button" class="checkout-form__submit"
                      @click="currentStep = 2; requestStatus = 'idle';">
                      Back to Contact
                    </button>
                  </div>
                </section>
              </div>
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
            <button v-if="currentStep == 1" type="button" class="checkout-form__submit" @click="proceedToContact">
              Proceed
            </button>
            <button v-if="currentStep == 2" type="button" class="checkout-form__submit" @click="proceedToContact">
              {{ submitting ? 'Submitting…' : 'Submit Order' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useCheckoutStore } from '../../stores/checkout';
  import { useCartStore } from '../../stores/cart';
  import type { CartItem } from '../../stores/cart';
  import { formatCurrency } from '../../utils/currency';

  const checkoutStore = useCheckoutStore();
  const cartStore = useCartStore();
  const { isOpen } = storeToRefs(checkoutStore);
  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');

  const cartItems = computed(() => cartStore.items);
  const hasCartItems = computed(() => cartItems.value.length > 0);
  const cartItemCount = computed(() => cartStore.itemCount);
  const cartSubtotalLabel = computed(() => {
    const total = cartStore.subtotal;
    if (!Number.isFinite(total) || total <= 0) return null;
    return formatCurrency(total, cartStore.firstCurrency);
  });

  const activeCartItemId = ref<string | null>(null);
  const panelRef = ref<HTMLElement | null>(null);

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
  const previewView = ref<PreviewView>('Front');
  watch(cartItems, (items) => {
    if (!items.length) {
      activeCartItemId.value = null;
      previewView.value = 'Front';
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


  function normalizePreview(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
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

  const previewSources = computed(() => resolvePreviewSources(activeCartItem.value));
  const previewAvailability = computed<Record<PreviewView, boolean>>(() => ({
    Front: Boolean(previewSources.value.Front),
    Back: Boolean(previewSources.value.Back),
  }));
  const activePreviewSrc = computed(() => previewSources.value[previewView.value] ?? null);

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

  const activeVariantLabel = computed(() => {
    const item = activeCartItem.value;
    if (!item) return 'No variant selected';
    const colorLabel = item.color?.name ?? 'Color TBD';
    const sizeLabel = item.size ?? 'Size TBD';
    return `${colorLabel} · ${sizeLabel}`;
  });

  const activeUnitPriceLabel = computed(() => {
    const item = activeCartItem.value;
    if (!item || !Number.isFinite(item.unitPrice)) return null;
    return formatCurrency(item.unitPrice as number, item.currency);
  });

  const activeMinimumQuantity = computed(() => activeCartItem.value?.minimumQuantity ?? 1);

  const activeQuantityHint = computed(() => {
    const min = activeMinimumQuantity.value;
    if (!min || min <= 1) return 'No minimum order requirement';
    return `Minimum order: ${min} pcs`;
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

    // Mark Step 2 complete and move to Step 3 (sending)
    step2Complete.value = true;
    currentStep.value = 3;
    requestStatus.value = 'processing';

    submitting.value = true;
    checkoutError.value = null;
    try {
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
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to start checkout. Please try again.');
      }
      if (!data?.checkoutUrl) {
        throw new Error('Checkout session was created without a redirect URL.');
      }

      window.location.href = data.checkoutUrl as string;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to start checkout. Please try again.';
      checkoutError.value = message;
      console.error('[Checkout] Stripe session error', error);
      requestStatus.value = 'error';
      currentStep.value = 2;
    } finally {
      submitting.value = false;
    }
  }

  function resetSteps() {
    currentStep.value = 1;
    step1Complete.value = false;
    step2Complete.value = false;
    requestStatus.value = 'idle';
  }

  function hydrateFromQuery() {
    const url = new URL(window.location.href);
    const state = url.searchParams.get('checkout');
    if (state === 'success') {
      step1Complete.value = true;
      step2Complete.value = true;
      requestStatus.value = 'success';
      currentStep.value = 3;
    } else if (state === 'canceled') {
      step1Complete.value = true;
      step2Complete.value = true;
      requestStatus.value = 'canceled';
      currentStep.value = 2;
    }
  }

  function close() {
    checkoutStore.cancelEditingCartItem();
    checkoutStore.setOpen(false);
  }

  watch(isOpen, (value) => {
    if (!value) {
      checkoutStore.cancelEditingCartItem();
      return;
    }
    nextTick(() => {
      resetSteps();
      hydrateFromQuery();
      panelRef.value?.focus();
    });
  });
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
    min-height: 0;
    overflow: auto;
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
    height: 90%;
  }

  .checkout-shell__aside {
    display: flex;
    flex-direction: row;
    width: auto;
    gap: 1rem;
  }

  .checkout-preview {
    display: block;
    flex-direction: column;
    background: #fff;
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    padding: clamp(1.1rem, 2.8vw, 1.6rem);
    padding-top: 0;
    box-sizing: border-box;
    overflow: scroll;
    height: auto;
  }


  .checkout-preview__controls {
    display: inline-flex;
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
    display: inline-flex;
    flex-direction: column;
    position: relative;


    width: 300px;
    overflow: scroll;
  }



  .checkout-preview__frame img {
    width: 100%;
    height: 100%;
    object-fit: contain;
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

  .checkout-summary {
    background: linear-gradient(140deg, rgba(226, 232, 240, 0.6), rgba(148, 163, 184, 0.18));
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    padding: clamp(1.1rem, 2.8vw, 1.6rem);
    box-shadow: 0 20px 36px rgba(15, 23, 42, 0.12);
    display: flex;

    gap: 1.25rem;
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
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    padding: clamp(1.1rem, 2.8vw, 1.6rem);
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
    overflow: scroll;
    margin-bottom: 5rem;
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

  .checkout-form__summary {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1.1rem;
    border-radius: 1rem;
    background: linear-gradient(135deg, rgba(226, 232, 240, 0.45), rgba(248, 250, 252, 0.7));
    border: 1px solid rgba(148, 163, 184, 0.26);
  }

  .checkout-form__summary>div {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .checkout-form__summary span {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .checkout-form__summary strong {
    font-size: 1rem;
    font-weight: 600;
    color: #0f172a;
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
</style>
