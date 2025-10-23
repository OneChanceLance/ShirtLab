import type { CartItemDesignPreviews } from '../stores/cart';
import type { DesignViewName, SerializedDesignState } from '../types/designState';

export type DesignCategory = 'full' | 'left';

export interface DesignChargeDetail {
  view: DesignViewName;
  category: DesignCategory;
  basePrice: number;
  multiplier: number;
  charge: number;
  widthInches?: number;
  heightInches?: number;
  source: 'bounds' | 'preview';
}

export interface QuantityDiscountDetail {
  type: '12+' | '24+';
  rate: number;
  amountPerUnit: number;
}

export interface PricingBreakdown {
  basePrice: number;
  designCharges: DesignChargeDetail[];
  designChargeTotal: number;
  quantityDiscount: QuantityDiscountDetail | null;
  subtotalBeforeDiscount: number;
  finalUnitPrice: number;
  pixelsPerInch: number;
}

export interface PricingInput {
  basePrice: number | null | undefined;
  designState: SerializedDesignState | null | undefined;
  designPreviews: CartItemDesignPreviews | null | undefined;
  clothingDefinition: Record<string, any> | null | undefined;
  quantity: number;
  logger?: (message: string, details?: Record<string, unknown>) => void;
}

const DESIGN_PRICE_THRESHOLD_INCHES = 8;
const DESIGN_FULL_PRICE = 18;
const DESIGN_LEFT_PRICE = 10;
const SECOND_SIDE_DISCOUNT = 0.5;
const DEFAULT_PIXELS_PER_INCH = 40;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function derivePixelsPerInch(definition: Record<string, any> | null | undefined): number {
  if (!definition) return DEFAULT_PIXELS_PER_INCH;
  const grid = definition.grid ?? {};

  const candidates = [grid.pxPerInch, grid.pixelsPerInch, grid.dpi];
  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value && value > 0) return value;
  }

  const widthInches = toNumber(grid.widthInches ?? grid.physicalWidth ?? grid.widthIn ?? grid.width_in);
  const heightInches = toNumber(grid.heightInches ?? grid.physicalHeight ?? grid.heightIn ?? grid.height_in);
  const widthPixels = toNumber(grid.w ?? grid.widthPx);
  const heightPixels = toNumber(grid.h ?? grid.heightPx);

  const ratios: number[] = [];
  if (widthInches && widthInches > 0 && widthPixels && widthPixels > 0) {
    ratios.push(widthPixels / widthInches);
  }
  if (heightInches && heightInches > 0 && heightPixels && heightPixels > 0) {
    ratios.push(heightPixels / heightInches);
  }

  if (ratios.length) {
    return ratios.reduce((acc, val) => acc + val, 0) / ratios.length;
  }

  return DEFAULT_PIXELS_PER_INCH;
}

function computeBoundsPx(view: SerializedDesignState['views'][DesignViewName] | undefined | null) {
  if (!view) return null;
  const images = Array.isArray(view.images) ? view.images : [];
  const texts = Array.isArray(view.texts) ? view.texts : [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasData = false;

  const includeRect = (x: unknown, y: unknown, w: unknown, h: unknown) => {
    const width = toNumber(w);
    const height = toNumber(h);
    const px = toNumber(x);
    const py = toNumber(y);
    if (!width || !height || width <= 0 || height <= 0 || px === null || py === null) return;
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px + width);
    maxY = Math.max(maxY, py + height);
    hasData = true;
  };

  for (const image of images) {
    includeRect(image.x, image.y, image.w, image.h);
  }

  for (const text of texts) {
    includeRect(text.x, text.y, text.w, text.h);
  }

  if (!hasData) return null;
  return {
    widthPx: Math.max(0, maxX - minX),
    heightPx: Math.max(0, maxY - minY),
  };
}

function classifyDesignCategory(
  viewName: DesignViewName,
  designState: SerializedDesignState | null | undefined,
  previews: CartItemDesignPreviews | null | undefined,
  ppi: number,
  logger?: PricingInput['logger'],
): DesignChargeDetail | null {
  const trimmedPreview = previews?.[viewName];
  const hasPreview = typeof trimmedPreview === 'string' && trimmedPreview.trim().length > 0;
  const view = designState?.views?.[viewName];
  const bounds = computeBoundsPx(view);

  if (!bounds) {
    if (!hasPreview) {
      logger?.(`No ${viewName} design detected.`);
      return null;
    }
    logger?.(`Detected ${viewName} preview without bounds; treating as left-chest charge.`, { view: viewName });
    return {
      view: viewName,
      category: 'left',
      basePrice: DESIGN_LEFT_PRICE,
      multiplier: 1,
      charge: DESIGN_LEFT_PRICE,
      source: 'preview',
    };
  }

  const widthInches = bounds.widthPx / (ppi || DEFAULT_PIXELS_PER_INCH);
  const heightInches = bounds.heightPx / (ppi || DEFAULT_PIXELS_PER_INCH);
  const isFull = widthInches > DESIGN_PRICE_THRESHOLD_INCHES || heightInches > DESIGN_PRICE_THRESHOLD_INCHES;
  const base = isFull ? DESIGN_FULL_PRICE : DESIGN_LEFT_PRICE;

  logger?.(`Measured ${viewName} design`, {
    widthInches: widthInches.toFixed(2),
    heightInches: heightInches.toFixed(2),
    category: isFull ? 'full' : 'left',
  });

  return {
    view: viewName,
    category: isFull ? 'full' : 'left',
    basePrice: base,
    multiplier: 1,
    charge: base,
    widthInches,
    heightInches,
    source: 'bounds',
  };
}

export function calculatePricing(input: PricingInput): PricingBreakdown {
  const {
    basePrice,
    designState,
    designPreviews,
    clothingDefinition,
    quantity,
    logger,
  } = input;

  const base = toNumber(basePrice) ?? 0;
  const ppi = derivePixelsPerInch(clothingDefinition);

  const designCharges: DesignChargeDetail[] = [];
  (['Front', 'Back'] as DesignViewName[]).forEach((viewName, index) => {
    const detail = classifyDesignCategory(viewName, designState ?? null, designPreviews, ppi, logger);
    if (!detail) return;
    const multiplier = index === 1 ? SECOND_SIDE_DISCOUNT : 1;
    const charge = roundCurrency(detail.basePrice * multiplier);
    designCharges.push({
      ...detail,
      multiplier,
      charge,
    });
    logger?.(`Applied ${index === 0 ? 'primary' : 'secondary'} ${detail.category} design charge`, {
      view: viewName,
      base: detail.basePrice,
      multiplier,
      charge,
    });
  });

  const designChargeTotal = designCharges.reduce((total, detail) => total + detail.charge, 0);
  logger?.('Total design charge', { totalCharge: designChargeTotal });

  const subtotalBeforeDiscount = base + designChargeTotal;
  logger?.('Base unit price before discounts', { base, designChargeTotal, subtotalBeforeDiscount });

  let quantityDiscount: QuantityDiscountDetail | null = null;
  let finalUnitPrice = subtotalBeforeDiscount;

  if (quantity > 24) {
    const rate = 0.2;
    const amountPerUnit = roundCurrency(subtotalBeforeDiscount * rate);
    finalUnitPrice = subtotalBeforeDiscount - amountPerUnit;
    quantityDiscount = { type: '24+', rate, amountPerUnit };
  } else if (quantity > 12) {
    const rate = 0.1;
    const amountPerUnit = roundCurrency(subtotalBeforeDiscount * rate);
    finalUnitPrice = subtotalBeforeDiscount - amountPerUnit;
    quantityDiscount = { type: '12+', rate, amountPerUnit };
  }

  if (quantityDiscount) {
    logger?.('Applied quantity discount', {
      quantity,
      discount: quantityDiscount.type,
      rate: quantityDiscount.rate,
      discountedUnitPrice: finalUnitPrice,
    });
  } else {
    logger?.('No quantity discount applied', { quantity });
  }

  finalUnitPrice = roundCurrency(finalUnitPrice);
  logger?.('Final unit price (rounded)', { finalUnitPrice });

  return {
    basePrice: roundCurrency(base),
    designCharges,
    designChargeTotal: roundCurrency(designChargeTotal),
    quantityDiscount,
    subtotalBeforeDiscount: roundCurrency(subtotalBeforeDiscount),
    finalUnitPrice,
    pixelsPerInch: ppi,
  };
}
