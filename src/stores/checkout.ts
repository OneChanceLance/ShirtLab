import { defineStore } from 'pinia';
import type { SizeMeasurementEntry } from '../utils/sizeMeasurements';
import { formatCurrency } from '../utils/currency';

export interface CheckoutProductSummary {
  id: string;
  name?: string | null;
  brand?: string | null;
  description?: string | null;
}

export interface CheckoutColorSummary {
  id: string;
  name?: string | null;
  hex?: string | null;
  price?: number | null;
  currency?: string | null;
  quantityMin?: number | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  sideUrl?: string | null;
}

export interface CheckoutCustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
}

interface SetVariantPayload {
  product: CheckoutProductSummary | null;
  color: CheckoutColorSummary | null;
  size: string | null;
  sizeMeasurements?: SizeMeasurementEntry[];
}

export const useCheckoutStore = defineStore('checkout', {
  state: () => ({
    isOpen: false,
    product: null as CheckoutProductSummary | null,
    color: null as CheckoutColorSummary | null,
    size: null as string | null,
    quantity: 1,
    sizeMeasurements: [] as SizeMeasurementEntry[],
    customer: {
      fullName: '',
      email: '',
      phone: '',
      company: '',
      notes: '',
    } as CheckoutCustomerInfo,
  }),
  getters: {
    hasVariant(state): boolean {
      return Boolean(state.product && state.color);
    },
    displayPrice(state): string | null {
      if (!state.color || state.color.price === null || state.color.price === undefined) return null;
      return formatCurrency(state.color.price, state.color.currency);
    },
    minimumQuantity(state): number {
      if (!state.color || !Number.isFinite(state.color.quantityMin ?? NaN)) return 1;
      const min = Number(state.color.quantityMin);
      return min > 0 ? Math.floor(min) : 1;
    },
  },
  actions: {
    setVariant({ product, color, size, sizeMeasurements }: SetVariantPayload) {
      this.product = product;
      this.color = color;
      this.size = size ?? null;
      if (Array.isArray(sizeMeasurements)) {
        this.sizeMeasurements = sizeMeasurements;
      }
      if (!Number.isFinite(this.quantity) || this.quantity < 1) {
        this.quantity = 1;
      }
    },
    setProduct(product: CheckoutProductSummary | null) {
      this.product = product;
    },
    setColor(color: CheckoutColorSummary | null) {
      this.color = color;
    },
    setSize(size: string | null) {
      this.size = size ?? null;
    },
    setSizeMeasurements(entries: SizeMeasurementEntry[]) {
      this.sizeMeasurements = Array.isArray(entries) ? entries : [];
    },
    setQuantity(quantity: number) {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        this.quantity = 1;
        return;
      }
      this.quantity = Math.floor(quantity);
    },
    ensureMinimumQuantity() {
      const min = this.minimumQuantity;
      if (this.quantity < min) {
        this.quantity = min;
      }
    },
    setOpen(open: boolean) {
      this.isOpen = open;
      if (open) this.ensureMinimumQuantity();
    },
    toggleOpen() {
      this.setOpen(!this.isOpen);
    },
    updateCustomerField<K extends keyof CheckoutCustomerInfo>(key: K, value: CheckoutCustomerInfo[K]) {
      this.customer[key] = value;
    },
    resetCustomer() {
      this.customer = {
        fullName: '',
        email: '',
        phone: '',
        company: '',
        notes: '',
      };
    },
    resetAll() {
      this.isOpen = false;
      this.product = null;
      this.color = null;
      this.size = null;
      this.quantity = 1;
      this.sizeMeasurements = [];
      this.resetCustomer();
    },
  },
});
