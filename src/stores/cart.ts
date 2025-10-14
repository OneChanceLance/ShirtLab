import { defineStore } from 'pinia';
import type { CheckoutColorSummary, CheckoutProductSummary } from './checkout';
import type { SizeMeasurementEntry } from '../utils/sizeMeasurements';

export interface CartItem {
  id: string;
  product: CheckoutProductSummary | null;
  color: CheckoutColorSummary | null;
  size: string | null;
  quantity: number;
  minimumQuantity: number;
  unitPrice: number | null;
  currency: string | null;
  previewImage: string | null;
  measurement?: SizeMeasurementEntry;
}

export interface AddCartItemPayload {
  product: CheckoutProductSummary | null;
  color: CheckoutColorSummary | null;
  size: string | null;
  quantity: number;
  minimumQuantity: number;
  unitPrice: number | null;
  currency: string | null;
  previewImage: string | null;
  measurement?: SizeMeasurementEntry;
}

function ensureMinimum(quantity: number, minimum: number): number {
  const safeMin = Number.isFinite(minimum) && minimum > 0 ? Math.floor(minimum) : 1;
  if (!Number.isFinite(quantity) || quantity <= 0) return safeMin;
  return Math.max(Math.floor(quantity), safeMin);
}

function resolveIdentifier(
  productId: string | null | undefined,
  colorId: string | null | undefined,
  size: string | null | undefined,
): string {
  const productKey = productId ? String(productId) : 'product';
  const colorKey = colorId ? String(colorId) : 'color';
  const sizeKey = size ? String(size) : 'nosize';
  return `${productKey}::${colorKey}::${sizeKey}`;
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    panelOpen: false,
  }),
  getters: {
    isEmpty(state): boolean {
      return state.items.length === 0;
    },
    uniqueCount(state): number {
      return state.items.length;
    },
    itemCount(state): number {
      return state.items.reduce((total, item) => total + item.quantity, 0);
    },
    subtotal(state): number {
      return state.items.reduce((total, item) => {
        if (!Number.isFinite(item.unitPrice)) return total;
        return total + (item.unitPrice as number) * item.quantity;
      }, 0);
    },
    firstCurrency(state): string | null {
      return state.items.find((item) => typeof item.currency === 'string' && item.currency)?.currency ?? null;
    },
    isPanelOpen(state): boolean {
      return state.panelOpen;
    },
  },
  actions: {
    addItem(payload: AddCartItemPayload) {
      const minimum = ensureMinimum(payload.minimumQuantity, payload.minimumQuantity);
      const quantityToAdd = ensureMinimum(payload.quantity, minimum);
      const identifier = resolveIdentifier(payload.product?.id, payload.color?.id, payload.size);
      const existing = this.items.find((entry) => entry.id === identifier);
      if (existing) {
        existing.quantity = ensureMinimum(existing.quantity + quantityToAdd, minimum);
        existing.minimumQuantity = minimum;
        existing.unitPrice = payload.unitPrice;
        existing.currency = payload.currency;
        existing.previewImage = payload.previewImage;
        existing.product = payload.product;
        existing.color = payload.color;
        existing.size = payload.size ?? null;
        existing.measurement = payload.measurement;
        return;
      }

      this.items.push({
        id: identifier,
        product: payload.product,
        color: payload.color,
        size: payload.size ?? null,
        quantity: quantityToAdd,
        minimumQuantity: minimum,
        unitPrice: payload.unitPrice,
        currency: payload.currency,
        previewImage: payload.previewImage ?? null,
        measurement: payload.measurement,
      });
    },
    setItemQuantity(id: string, quantity: number) {
      const entry = this.items.find((item) => item.id === id);
      if (!entry) return;
      if (!Number.isFinite(quantity) || quantity <= 0) {
        this.removeItem(id);
        return;
      }
      entry.quantity = ensureMinimum(quantity, entry.minimumQuantity);
    },
    removeItem(id: string) {
      this.items = this.items.filter((item) => item.id !== id);
      if (this.items.length === 0) {
        this.panelOpen = false;
      }
    },
    clear() {
      this.items = [];
      this.panelOpen = false;
    },
    openPanel() {
      if (this.items.length === 0) return;
      this.panelOpen = true;
    },
    closePanel() {
      this.panelOpen = false;
    },
    togglePanel() {
      if (this.panelOpen) {
        this.closePanel();
      } else {
        this.openPanel();
      }
    },
  },
});

export function buildCartItemId(
  productId: string | null | undefined,
  colorId: string | null | undefined,
  size: string | null | undefined,
): string {
  return resolveIdentifier(productId, colorId, size);
}
