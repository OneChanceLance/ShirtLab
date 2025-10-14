<template>
  <Teleport to="body">
    <transition name="checkout-drawer-fade">
      <div v-if="isOpen" class="checkout-drawer">
        <div class="checkout-drawer__backdrop" @click.self="close">
          <section class="checkout-drawer__panel" tabindex="-1" @keydown.esc.prevent="close">
            <header class="checkout-drawer__header">
              <div>
                <h2>Checkout</h2>
                <p class="checkout-drawer__subtitle">
                  {{ activeCartItem ? activeProductTitle : 'Review your cart' }}
                </p>
              </div>
              <button type="button" class="checkout-drawer__close" @click="close">
                Close
              </button>
            </header>

            <div v-if="hasCartItems" class="checkout-drawer__content">
              <aside class="checkout-drawer__summary">
                <div class="checkout-drawer__active">
                  <div class="checkout-drawer__preview" :class="{ 'has-image': Boolean(activePreviewImage) }">
                    <img v-if="activePreviewImage" :src="activePreviewImage"
                      :alt="`Preview of ${activeVariantLabel}`" />
                    <div v-else class="checkout-drawer__placeholder">
                      Preview not available
                    </div>
                  </div>

                  <div class="checkout-drawer__details">
                    <p class="checkout-drawer__variant">{{ activeVariantLabel }}</p>
                    <p v-if="activeUnitPriceLabel" class="checkout-drawer__price">{{ activeUnitPriceLabel }}</p>
                    <p class="checkout-drawer__hint">{{ activeQuantityHint }}</p>
                    <div class="checkout-drawer__quantity">
                      <span>Quantity</span>
                      <div class="checkout-drawer__quantity-input">
                        <button type="button" @click="decrementActiveQuantity" aria-label="Decrease quantity">
                          −
                        </button>
                        <input type="number" :min="activeMinimumQuantity || 1"
                          :value="activeCartItem?.quantity ?? (activeMinimumQuantity || 1)"
                          @change="onActiveQuantityChange" />
                        <button type="button" @click="incrementActiveQuantity" aria-label="Increase quantity">
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="checkout-drawer__cart-list">
                  <h3>Items</h3>
                  <ul>
                    <li v-for="item in cartItems" :key="item.id"
                      :class="['checkout-drawer__cart-item', { active: item.id === activeCartItemId }]">
                      <button type="button" class="checkout-drawer__cart-select" @click="setActiveCartItem(item.id)">
                        <span class="title">{{ item.product?.name ?? 'Selected Product' }}</span>
                        <span class="variant">{{ cartItemVariantLabel(item) }}</span>
                        <span class="qty">Qty {{ item.quantity }}</span>
                      </button>
                      <div class="checkout-drawer__cart-actions">
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
                  </ul>
                  <footer class="checkout-drawer__cart-footer">
                    <span>Subtotal</span>
                    <span>{{ cartSubtotalLabel ?? '—' }}</span>
                  </footer>
                </div>

                <div v-if="activeMeasurements.length" class="checkout-drawer__measurements">
                  <h3>Measurements · {{ activeMeasurementSizeLabel }}</h3>
                  <table>
                    <tbody>
                      <tr v-for="spec in activeMeasurements" :key="spec.key">
                        <th>{{ spec.type }}</th>
                        <td>{{ spec.value }} {{ spec.unit }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </aside>

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
                    <input type="tel" v-model="phoneField" placeholder="(555) 123-4567" />
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
                  {{ submitting ? 'Submitting…' : 'Request Quote' }}
                </button>
              </form>
            </div>

            <div v-else class="checkout-drawer__empty">
              <p>Your cart is empty. Add items to continue.</p>
              <button type="button" @click="close">Go back</button>
            </div>
          </section>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
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

  watch(cartItems, (items) => {
    if (!items.length) {
      activeCartItemId.value = null;
      return;
    }
    if (!items.some((item) => item.id === activeCartItemId.value)) {
      activeCartItemId.value = items[0].id;
    }
  }, { immediate: true });

  const activeCartItem = computed<CartItem | null>(() => {
    if (!cartItems.value.length) return null;
    const existing = cartItems.value.find((item) => item.id === activeCartItemId.value);
    return existing ?? cartItems.value[0];
  });

  const activeProductTitle = computed(() => {
    const product = activeCartItem.value?.product;
    if (!product) return 'Selected Product';
    const brand = product.brand?.trim();
    const name = product.name?.trim();
    if (brand && name) return `${brand} · ${name}`;
    return brand || name || 'Selected Product';
  });

  const activePreviewImage = computed(() => activeCartItem.value?.previewImage ?? null);

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

  const activeMeasurements = computed(() => activeCartItem.value?.measurement?.specs ?? []);
  const activeMeasurementSizeLabel = computed(() => activeCartItem.value?.measurement?.sizeLabel ?? '');

  function setActiveCartItem(id: string) {
    if (activeCartItemId.value === id) return;
    activeCartItemId.value = id;
  }

  function incrementActiveQuantity() {
    const item = activeCartItem.value;
    if (!item) return;
    cartStore.setItemQuantity(item.id, item.quantity + 1);
  }

  function decrementActiveQuantity() {
    const item = activeCartItem.value;
    if (!item) return;
    if (item.quantity <= item.minimumQuantity) {
      cartStore.removeItem(item.id);
      return;
    }
    cartStore.setItemQuantity(item.id, item.quantity - 1);
  }

  function onActiveQuantityChange(event: Event) {
    const item = activeCartItem.value;
    if (!item) return;
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = Number(target.value);
    cartStore.setItemQuantity(item.id, value);
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
    } finally {
      submitting.value = false;
    }
  }

  function close() {
    checkoutStore.setOpen(false);
  }
</script>

<style scoped>

  .checkout-drawer-fade-enter-active,
  .checkout-drawer-fade-leave-active {
    transition: opacity 0.25s ease;
  }

  .checkout-drawer-fade-enter-from,
  .checkout-drawer-fade-leave-to {
    opacity: 0;
  }

  .checkout-drawer {
    position: fixed;
    inset: 0;
    z-index: 4000;
    display: flex;
    justify-content: flex-end;
  }

  .checkout-drawer__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(4px);
  }

  .checkout-drawer__panel {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: min(560px, 100%);
    background: #f9fafb;
    box-shadow: -12px 0 36px rgba(15, 23, 42, 0.3);
    display: flex;
    flex-direction: column;
    padding: 1.75rem 2rem;
    overflow-y: auto;
    animation: checkout-panel-in 0.28s ease forwards;
    color: #0f172a;
  }

  .checkout-drawer__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .checkout-drawer__header h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
  }

  .checkout-drawer__subtitle {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    color: #475569;
  }

  .checkout-drawer__close {
    border: none;
    background: transparent;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #64748b;
    cursor: pointer;
    transition: color 0.18s ease;
  }

  .checkout-drawer__close:hover {
    color: #0f172a;
  }

  .checkout-drawer__content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .checkout-drawer__summary {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.2rem;
    background: linear-gradient(135deg, rgba(14, 23, 42, 0.04), rgba(148, 201, 64, 0.08));
    border-radius: 18px;
    border: 1px solid rgba(148, 201, 64, 0.18);
  }

  .checkout-drawer__active {
    display: flex;
    gap: 1.25rem;
    align-items: center;
  }

  .checkout-drawer__preview {
    width: 170px;
    height: 170px;
    border-radius: 16px;
    background: rgba(148, 201, 64, 0.12);
    border: 1px solid rgba(148, 201, 64, 0.18);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .checkout-drawer__preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .checkout-drawer__placeholder {
    font-size: 0.9rem;
    color: #475569;
    text-align: center;
  }

  .checkout-drawer__details {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    flex: 1;
  }

  .checkout-drawer__variant {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .checkout-drawer__price {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #14532d;
  }

  .checkout-drawer__hint {
    margin: 0;
    font-size: 0.85rem;
    color: #475569;
  }

  .checkout-drawer__quantity {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .checkout-drawer__quantity span {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .checkout-drawer__quantity-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .checkout-drawer__quantity-input button {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 999px;
    border: none;
    background: rgba(148, 201, 64, 0.25);
    color: #0f172a;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.18s ease, background 0.18s ease;
  }

  .checkout-drawer__quantity-input button:hover {
    transform: translateY(-1px);
    background: rgba(148, 201, 64, 0.38);
  }

  .checkout-drawer__quantity-input input {
    width: 72px;
    padding: 0.5rem 0.4rem;
    border-radius: 10px;
    border: 1px solid #cbd5f5;
    font-size: 0.95rem;
    text-align: center;
  }

  .checkout-drawer__cart-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkout-drawer__cart-list h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
  }

  .checkout-drawer__cart-list ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkout-drawer__cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px solid rgba(148, 201, 64, 0.2);
    background: rgba(255, 255, 255, 0.65);
  }

  .checkout-drawer__cart-item.active {
    border-color: rgba(22, 163, 74, 0.55);
    box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.2);
  }

  .checkout-drawer__cart-select {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    flex: 1;
    color: inherit;
    padding: 0;
  }

  .checkout-drawer__cart-select .title {
    font-size: 0.92rem;
    font-weight: 600;
    color: #0f172a;
  }

  .checkout-drawer__cart-select .variant {
    font-size: 0.8rem;
    color: #475569;
  }

  .checkout-drawer__cart-select .qty {
    font-size: 0.78rem;
    color: #14532d;
    font-weight: 600;
  }

  .checkout-drawer__cart-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .checkout-drawer__cart-actions button {
    border: none;
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
    cursor: pointer;
    background: rgba(148, 201, 64, 0.18);
    color: #0f172a;
    transition: background 0.18s ease;
  }

  .checkout-drawer__cart-actions button:hover {
    background: rgba(148, 201, 64, 0.32);
  }

  .checkout-drawer__cart-actions .remove {
    background: rgba(248, 113, 113, 0.18);
    color: #991b1b;
  }

  .checkout-drawer__cart-actions .remove:hover {
    background: rgba(248, 113, 113, 0.3);
  }

  .checkout-drawer__cart-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 0.9rem;
    color: #0f172a;
  }

  .checkout-drawer__measurements h3 {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
  }

  .checkout-drawer__measurements table {
    width: 100%;
    border-collapse: collapse;
  }

  .checkout-drawer__measurements th,
  .checkout-drawer__measurements td {
    text-align: left;
    padding: 0.4rem 0;
    font-size: 0.86rem;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }

  .checkout-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .checkout-form__grid label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
  }

  .checkout-form__grid span {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .checkout-form__grid input,
  .checkout-form__grid textarea {
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid #cbd5f5;
    font-size: 0.95rem;
  }

  .checkout-form__notes {
    grid-column: span 2;
  }

  .checkout-form__summary {
    margin-top: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    background: rgba(148, 201, 64, 0.1);
    border: 1px solid rgba(148, 201, 64, 0.2);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }

  .checkout-form__summary span {
    display: block;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #475569;
  }

  .checkout-form__summary strong {
    display: block;
    font-size: 0.98rem;
    color: #0f172a;
  }

  .checkout-form__error {
    margin: 0.75rem 0 0;
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.4);
    color: #991b1b;
    font-size: 0.85rem;
  }

  .checkout-form__submit {
    margin-top: 1.25rem;
    width: 100%;
    padding: 0.9rem;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #9ae67b, #a4f08d);
    color: #0f172a;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    box-shadow: 0 12px 24px rgba(148, 201, 64, 0.35);
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .checkout-form__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }

  .checkout-form__submit:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 24px rgba(148, 201, 64, 0.45);
  }

  .checkout-drawer__empty {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: #475569;
    text-align: center;
  }

  .checkout-drawer__empty button {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1.2rem;
    background: rgba(148, 201, 64, 0.25);
    color: #0f172a;
    cursor: pointer;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .checkout-drawer__panel {
      padding: 1.5rem 1.25rem;
    }

    .checkout-drawer__summary {
      padding: 1rem;
    }

    .checkout-drawer__active {
      flex-direction: column;
      align-items: stretch;
    }

    .checkout-drawer__preview {
      width: 100%;
      height: 220px;
    }

    .checkout-drawer__cart-item {
      flex-direction: column;
      align-items: stretch;
    }

    .checkout-drawer__cart-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .checkout-form__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .checkout-form__notes {
      grid-column: span 1;
    }

    .checkout-form__summary {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @keyframes checkout-panel-in {
    from {
      transform: translateX(30px);
      opacity: 0;
    }

    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
