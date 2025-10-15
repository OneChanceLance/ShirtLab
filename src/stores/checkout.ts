import { defineStore } from 'pinia';
import type { SizeMeasurementEntry } from '../utils/sizeMeasurements';
import { formatCurrency } from '../utils/currency';
import type { CartItem } from './cart';
import type { SerializedDesignState } from '../types/designState';

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

type DesignView = 'Front' | 'Back';

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
    designPreviews: {
      Front: null,
      Back: null,
    } as Record<DesignView, string | null>,
    activeDesignView: 'Front' as DesignView,
    customer: {
      fullName: '',
      email: '',
      phone: '',
      company: '',
      notes: '',
    } as CheckoutCustomerInfo,
    editingCartItemId: null as string | null,
    designState: null as SerializedDesignState | null,
    clothingDefinition: null as Record<string, any> | null,
    designStateProvider: null as (() => SerializedDesignState | null) | null,
    editingBaselineDesignState: null as SerializedDesignState | null,
    editingBaselineClothingDefinition: null as Record<string, any> | null,
    editingSessionVersion: 0,
    editingCancelVersion: 0,
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
    activeDesignPreview(state): string | null {
      const primary = state.designPreviews[state.activeDesignView];
      if (primary) return primary;
      return state.designPreviews.Front || state.designPreviews.Back || null;
    },
    isEditingCartItem(state): boolean {
      return Boolean(state.editingCartItemId);
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
      this.resetDesignPreviews();
      this.resetCustomer();
      this.editingCartItemId = null;
      this.designState = null;
      this.clothingDefinition = null;
    },
    setDesignPreview(view: DesignView, preview: string | null) {
      this.designPreviews[view] = typeof preview === 'string' && preview.trim() ? preview : null;
    },
    resetDesignPreviews() {
      this.designPreviews.Front = null;
      this.designPreviews.Back = null;
      this.activeDesignView = 'Front';
    },
    setActiveDesignView(view: DesignView) {
      this.activeDesignView = view;
    },
    beginEditingCartItem(item: CartItem) {
      this.editingCartItemId = item.id;
      this.editingSessionVersion += 1;
      this.product = item.product;
      this.color = item.color;
      this.size = item.size ?? null;
      const safeQuantity = Number.isFinite(item.quantity) && item.quantity > 0
        ? Math.floor(item.quantity)
        : 1;
      this.quantity = safeQuantity;
      this.sizeMeasurements = item.measurement ? [item.measurement] : [];
      if (item.previewImage) {
        this.setDesignPreview('Front', item.previewImage);
      }
      this.ensureMinimumQuantity();
      const baselineDesign = item.designState ? cloneValue(item.designState) : null;
      const baselineDefinition = item.clothingDefinition ? cloneValue(item.clothingDefinition) : null;
      this.editingBaselineDesignState = baselineDesign ? cloneValue(baselineDesign) : null;
      this.editingBaselineClothingDefinition = baselineDefinition ? cloneValue(baselineDefinition) : null;
      this.designState = baselineDesign ? cloneValue(baselineDesign) : null;
      this.clothingDefinition = baselineDefinition ? cloneValue(baselineDefinition) : null;
    },
    finishEditingCartItem() {
      this.editingCartItemId = null;
      this.editingBaselineDesignState = null;
      this.editingBaselineClothingDefinition = null;
    },
    setEditingCartItemId(id: string | null) {
      this.editingCartItemId = id;
    },
    registerDesignStateProvider(provider: (() => SerializedDesignState | null) | null) {
      this.designStateProvider = provider;
    },
    captureDesignState(): SerializedDesignState | null {
      if (typeof this.designStateProvider === 'function') {
        const next = this.designStateProvider();
        this.designState = next ? cloneValue(next) : null;
      }
      return this.designState;
    },
    setDesignState(state: SerializedDesignState | null) {
      this.designState = state ? cloneValue(state) : null;
    },
    setClothingDefinition(definition: Record<string, any> | null) {
      this.clothingDefinition = definition ? cloneValue(definition) : null;
    },
    cancelEditingCartItem() {
      const baselineDefinition = this.editingBaselineClothingDefinition ? cloneValue(this.editingBaselineClothingDefinition) : null;
      const baselineDesign = this.editingBaselineDesignState ? cloneValue(this.editingBaselineDesignState) : null;
      this.clothingDefinition = baselineDefinition;
      this.designState = baselineDesign;
      this.editingBaselineClothingDefinition = null;
      this.editingBaselineDesignState = null;
      this.editingCartItemId = null;
      this.editingCancelVersion += 1;
    },
  },
});
