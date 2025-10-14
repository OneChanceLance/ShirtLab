<template>
  <Teleport to=".embed-wrapper">
    <transition name="cart-panel">
      <div v-if="isOpen" class="cart-panel">
        <div class="cart-panel__backdrop" @click="close"></div>
        <aside class="cart-panel__drawer" role="dialog" aria-modal="true">
          <header class="cart-panel__header">
            <div>
              <h3>Cart</h3>
              <p class="cart-panel__subtitle">
                {{ cartItemCount ? `${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} ready` : 'No items yet' }}
              </p>
            </div>
            <button type="button" class="cart-panel__close" @click="close">Close</button>
          </header>

          <div v-if="!cartIsEmpty" class="cart-panel__content">
            <ul class="cart-panel__list">
              <li v-for="item in cartItems" :key="item.id" class="cart-item">
                <div class="cart-item__preview" :class="{ 'has-image': Boolean(item.previewImage) }">
                  <img
                    v-if="item.previewImage"
                    :src="item.previewImage"
                    :alt="cartItemVariantLabel(item)"
                  />
                  <div v-else class="cart-item__placeholder">
                    No preview
                  </div>
                </div>
                <div class="cart-item__info">
                  <p class="cart-item__name">{{ item.product?.name ?? 'Selected Product' }}</p>
                  <p class="cart-item__variant">{{ cartItemVariantLabel(item) }}</p>
                  <p v-if="cartItemUnitPriceLabel(item)" class="cart-item__unit">
                    {{ cartItemUnitPriceLabel(item) }} · unit
                  </p>
                </div>
                <div class="cart-item__quantity">
                  <button type="button" @click="decrementCartItemQuantity(item)" aria-label="Decrease item quantity">
                    −
                  </button>
                  <input
                    type="number"
                    :min="item.minimumQuantity || 1"
                    :value="item.quantity"
                    @change="onCartItemQuantityChange(item.id, $event)"
                  />
                  <button type="button" @click="incrementCartItemQuantity(item)" aria-label="Increase item quantity">
                    +
                  </button>
                  <p v-if="item.minimumQuantity > 1" class="cart-item__hint">Min {{ item.minimumQuantity }}</p>
                </div>
                <div class="cart-item__total">
                  <span>{{ cartItemTotalLabel(item) }}</span>
                  <button type="button" class="cart-item__remove" @click="removeCartItem(item.id)">
                    Remove
                  </button>
                </div>
              </li>
            </ul>
            <footer class="cart-panel__footer">
              <div class="cart-panel__totals">
                <span>Subtotal</span>
                <strong>{{ cartSubtotalLabel ?? '—' }}</strong>
              </div>
              <div class="cart-panel__actions">
                <button type="button" class="cart-panel__clear" @click="clearCart">
                  Clear cart
                </button>
                <button type="button" class="cart-panel__checkout" @click="goToCheckout">
                  Checkout
                </button>
              </div>
            </footer>
          </div>
          <div v-else class="cart-panel__empty">
            <p>Your cart is empty. Add items to preview them here.</p>
            <button type="button" @click="close">Start customizing</button>
          </div>
        </aside>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useCartStore } from '../../stores/cart';
  import type { CartItem } from '../../stores/cart';
  import { useCheckoutStore } from '../../stores/checkout';
  import { formatCurrency } from '../../utils/currency';

  const cartStore = useCartStore();
  const checkoutStore = useCheckoutStore();

  const isOpen = computed(() => cartStore.isPanelOpen);
  const cartItems = computed(() => cartStore.items);
  const cartIsEmpty = computed(() => cartStore.isEmpty);
  const cartItemCount = computed(() => cartStore.itemCount);
  const cartSubtotalLabel = computed(() => {
    const total = cartStore.subtotal;
    if (!Number.isFinite(total) || total <= 0) return null;
    return formatCurrency(total, cartStore.firstCurrency);
  });

  function close() {
    cartStore.closePanel();
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

  function onCartItemQuantityChange(id: string, event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = Number(target.value);
    cartStore.setItemQuantity(id, value);
  }

  function removeCartItem(id: string) {
    cartStore.removeItem(id);
  }

  function clearCart() {
    cartStore.clear();
  }

  function cartItemVariantLabel(item: CartItem): string {
    const colorLabel = item.color?.name ?? 'Color TBD';
    const sizeLabel = item.size ?? 'Size TBD';
    return `${colorLabel} · ${sizeLabel}`;
  }

  function cartItemUnitPriceLabel(item: CartItem): string | null {
    if (!Number.isFinite(item.unitPrice)) return null;
    return formatCurrency(item.unitPrice as number, item.currency);
  }

  function cartItemTotalLabel(item: CartItem): string {
    if (!Number.isFinite(item.unitPrice)) return `${item.quantity} pcs`;
    const lineTotal = (item.unitPrice as number) * item.quantity;
    return formatCurrency(lineTotal, item.currency) ?? `${item.quantity} pcs`;
  }

  function goToCheckout() {
    if (cartIsEmpty.value) return;
    close();
    checkoutStore.setOpen(true);
  }
</script>

<style scoped>
  .cart-panel {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2500;
  }

  .cart-panel__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.32);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .cart-panel__drawer {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: min(420px, 90vw);
    background: #0f172a;
    color: #f8fafc;
    box-shadow: -18px 0 48px rgba(15, 23, 42, 0.45);
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    gap: 1.25rem;
    pointer-events: auto;
  }

  .cart-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .cart-panel__header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .cart-panel__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.75);
  }

  .cart-panel__close {
    border: none;
    background: transparent;
    color: rgba(226, 232, 240, 0.75);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .cart-panel__close:hover {
    color: #f8fafc;
  }

  .cart-panel__content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .cart-panel__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .cart-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 1rem;
    align-items: center;
    background: rgba(15, 23, 42, 0.45);
    border-radius: 14px;
    padding: 0.75rem;
    border: 1px solid rgba(148, 201, 64, 0.25);
  }

  .cart-item__preview {
    width: 72px;
    height: 72px;
    border-radius: 12px;
    background: rgba(148, 201, 64, 0.12);
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
    padding: 0.25rem;
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
    background: rgba(15, 23, 42, 0.35);
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

  .cart-panel__footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .cart-panel__totals {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .cart-panel__totals span {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.65);
  }

  .cart-panel__totals strong {
    font-size: 1.1rem;
  }

  .cart-panel__actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .cart-panel__clear {
    border-radius: 999px;
    border: 1px solid rgba(226, 232, 240, 0.35);
    background: transparent;
    color: rgba(226, 232, 240, 0.8);
    padding: 0.55rem 1.2rem;
    font-size: 0.82rem;
    cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
  }

  .cart-panel__clear:hover {
    border-color: rgba(226, 232, 240, 0.6);
    color: #f8fafc;
  }

  .cart-panel__checkout {
    border: none;
    border-radius: 999px;
    padding: 0.65rem 1.35rem;
    background: linear-gradient(135deg, #9ae67b, #a4f08d);
    color: #0f172a;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    box-shadow: 0 12px 24px rgba(148, 201, 64, 0.35);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .cart-panel__checkout:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 28px rgba(148, 201, 64, 0.45);
  }

  .cart-panel__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 1rem;
    color: rgba(226, 232, 240, 0.75);
  }

  .cart-panel__empty button {
    border-radius: 999px;
    border: none;
    padding: 0.6rem 1.2rem;
    background: rgba(148, 201, 64, 0.25);
    color: #0f172a;
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .cart-panel__drawer {
      width: 100%;
    }

    .cart-item {
      grid-template-columns: minmax(0, 1fr);
    }

    .cart-item__preview {
      width: 100%;
      height: 180px;
    }

    .cart-item__quantity {
      flex-direction: row;
      justify-content: flex-start;
    }

    .cart-item__total {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .cart-panel__actions {
      flex-direction: column;
      align-items: stretch;
    }

    .cart-panel__clear,
    .cart-panel__checkout {
      width: 100%;
      text-align: center;
    }
  }

  .cart-panel-enter-from,
  .cart-panel-leave-to {
    opacity: 0;
  }

  .cart-panel-enter-from .cart-panel__drawer,
  .cart-panel-leave-to .cart-panel__drawer {
    transform: translateX(30px);
  }

  .cart-panel-enter-active,
  .cart-panel-leave-active {
    transition: opacity 0.22s ease;
  }

  .cart-panel-enter-active .cart-panel__drawer,
  .cart-panel-leave-active .cart-panel__drawer {
    transition: transform 0.22s ease;
  }
</style>
