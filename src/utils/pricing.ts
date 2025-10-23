import type { CartItemDesignPreviews } from '../stores/cart';
import type { DesignViewName, SerializedDesignState } from '../types/designState';

export type DesignCategory = 'full' | 'left';

export interface DesignChargeDetail {
  view: DesignViewName;
  elementIndex?: number;
  elementType?: 'image' | 'text';
  category: DesignCategory;
  basePrice: number;
  multiplier: number;
  charge: number;
  widthInches?: number;
  heightInches?: number;
  coverageRatio?: number;
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
const FULL_GRID_RATIO_THRESHOLD = 0.7;

const FALLBACK_GRID_INCHES: Record<string, number> = {
  width: 12,
  height: 18,
};

function resolveSizeBaseline(definition: Record<string, any> | null | undefined): number | null {
  if (!definition) return null;
  const raw = definition.size;
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized) return null;
  const forcedNumeric = Number(normalized);
  if (Number.isFinite(forcedNumeric)) {
    return forcedNumeric;
  }
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  const match = normalized.match(/\(?\s*(\d+)\s*(?:[\/-]\s*(\d+))?\s*(?:Y|YR|YEAR|K)\s*\)?/);
  if (match) {
    const years = Number(match[1]);
    if (Number.isFinite(years)) {
      return Math.max(0, years);
    }
  }
  const fractional = normalized.match(/(\d+)\s*(?:\/|\.)\s*(\d+)/);
  if (fractional) {
    const a = Number(fractional[1]);
    const b = Number(fractional[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      return a / b;
    }
  }
  return null;
}

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


function computeGridPixelsPerInch(grid: Record<string, any> | null | undefined): number | null {
  if (!grid) return null;
  const explicit = toNumber((grid as any).pxPerInch ?? (grid as any).pixelsPerInch ?? (grid as any).dpi ?? (grid as any).ppi);
  if (explicit && explicit > 0) return explicit;

  const widthPixels = toNumber((grid as any).w ?? (grid as any).widthPx ?? (grid as any).width);
  const heightPixels = toNumber((grid as any).h ?? (grid as any).heightPx ?? (grid as any).height);
  const widthInches = toNumber((grid as any).widthInches ?? (grid as any).physicalWidth ?? (grid as any).widthIn ?? (grid as any).width_in);
  const heightInches = toNumber((grid as any).heightInches ?? (grid as any).physicalHeight ?? (grid as any).heightIn ?? (grid as any).height_in);

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

  return null;
}

function derivePixelsPerInch(definition: Record<string, any> | null | undefined): number {
  if (!definition) return DEFAULT_PIXELS_PER_INCH;
  const grid = definition.grid ?? {};

  const gridPpi = computeGridPixelsPerInch(grid);
  if (gridPpi && gridPpi > 0) return gridPpi;

  const widthPixels = toNumber((grid as any).w ?? (grid as any).widthPx ?? (grid as any).width);
  const heightPixels = toNumber((grid as any).h ?? (grid as any).heightPx ?? (grid as any).height);

  if (widthPixels && heightPixels) {
    const sizeBaseline = resolveSizeBaseline(definition);
    if (sizeBaseline) {
      const assumedWidthInches = FALLBACK_GRID_INCHES.width * (sizeBaseline / 12);
      const assumedHeightInches = FALLBACK_GRID_INCHES.height * (sizeBaseline / 12);
      const derivedWidth = widthPixels / assumedWidthInches;
      const derivedHeight = heightPixels / assumedHeightInches;
      const avg = (derivedWidth + derivedHeight) / 2;
      if (avg > 0) {
        return avg;
      }
    }
  }

  return DEFAULT_PIXELS_PER_INCH;
}

type DesignElement = {
  widthPx: number;
  heightPx: number;
  index: number;
  type: 'image' | 'text';
};

function extractDesignElements(view: SerializedDesignState['views'][DesignViewName] | undefined | null): DesignElement[] {
  if (!view) return [];
  const elements: DesignElement[] = [];

  const images = Array.isArray(view.images) ? view.images : [];
  images.forEach((img, idx) => {
    const widthPx = toNumber((img as any)?.w);
    const heightPx = toNumber((img as any)?.h);
    if (widthPx && widthPx > 0 && heightPx && heightPx > 0) {
      elements.push({
        widthPx,
        heightPx,
        index: idx,
        type: 'image',
      });
    }
  });

  const texts = Array.isArray(view.texts) ? view.texts : [];
  texts.forEach((txt, idx) => {
    const widthPx = toNumber((txt as any)?.w);
    const heightPx = toNumber((txt as any)?.h);
    if (widthPx && widthPx > 0 && heightPx && heightPx > 0) {
      elements.push({
        widthPx,
        heightPx,
        index: idx,
        type: 'text',
      });
    }
  });

  return elements;
}

function classifyDesignCategory(
  viewName: DesignViewName,
  designState: SerializedDesignState | null | undefined,
  previews: CartItemDesignPreviews | null | undefined,
  grid: Record<string, any> | null | undefined,
  fallbackPpi: number,
  logger?: PricingInput['logger'],
): DesignChargeDetail[] {
  const gridWidthPx = toNumber((grid as any)?.w ?? (grid as any)?.widthPx ?? (grid as any)?.width);
  const gridHeightPx = toNumber((grid as any)?.h ?? (grid as any)?.heightPx ?? (grid as any)?.height);
  const gridWidthInches = toNumber((grid as any)?.widthInches ?? (grid as any)?.physicalWidth ?? (grid as any)?.widthIn ?? (grid as any)?.width_in);
  const gridHeightInches = toNumber((grid as any)?.heightInches ?? (grid as any)?.physicalHeight ?? (grid as any)?.heightIn ?? (grid as any)?.height_in);
  const gridPpi = computeGridPixelsPerInch(grid) ?? fallbackPpi ?? DEFAULT_PIXELS_PER_INCH;

  const elements = extractDesignElements(designState?.views?.[viewName]);
  const trimmedPreview = previews?.[viewName];
  const hasPreview = typeof trimmedPreview === 'string' && trimmedPreview.trim().length > 0;
  const charges: DesignChargeDetail[] = [];

  if (!elements.length) {
    if (!hasPreview) {
      logger?.(`No ${viewName} design detected.`);
      return charges;
    }
    logger?.(`Detected ${viewName} preview without bounds; treating as left-chest charge.`, { view: viewName });
    charges.push({
      view: viewName,
      category: 'left',
      basePrice: DESIGN_LEFT_PRICE,
      multiplier: 1,
      charge: DESIGN_LEFT_PRICE,
      source: 'preview',
    });
    return charges;
  }

  const computeDimension = (
    boundsPx: number,
    gridPx: number | null,
    gridInches: number | null,
    ppi: number,
  ): number => {
    if (gridPx && gridPx > 0 && gridInches && gridInches > 0) {
      const ratio = boundsPx / gridPx;
      return ratio * gridInches;
    }
    if (ppi && ppi > 0) {
      return boundsPx / ppi;
    }
    return boundsPx / DEFAULT_PIXELS_PER_INCH;
  };

  elements.forEach((element) => {
    const widthInches = computeDimension(element.widthPx, gridWidthPx, gridWidthInches, gridPpi);
    const heightInches = computeDimension(element.heightPx, gridHeightPx, gridHeightInches, gridPpi);
    const widthRatio = gridWidthPx && gridWidthPx > 0 ? element.widthPx / gridWidthPx : null;
    const heightRatio = gridHeightPx && gridHeightPx > 0 ? element.heightPx / gridHeightPx : null;

    let isFull = false;
    if (
      (typeof widthRatio === 'number' && widthRatio >= FULL_GRID_RATIO_THRESHOLD) ||
      (typeof heightRatio === 'number' && heightRatio >= FULL_GRID_RATIO_THRESHOLD)
    ) {
      isFull = true;
    } else if (widthInches > DESIGN_PRICE_THRESHOLD_INCHES || heightInches > DESIGN_PRICE_THRESHOLD_INCHES) {
      isFull = true;
    }

    const base = isFull ? DESIGN_FULL_PRICE : DESIGN_LEFT_PRICE;
    const chargeDetail: DesignChargeDetail = {
      view: viewName,
      elementIndex: element.index,
      elementType: element.type,
      category: isFull ? 'full' : 'left',
      basePrice: base,
      multiplier: 1,
      charge: base,
      widthInches,
      heightInches,
      coverageRatio: Math.max(
        typeof widthRatio === 'number' ? widthRatio : 0,
        typeof heightRatio === 'number' ? heightRatio : 0,
      ),
      source: 'bounds',
    };

    logger?.(`Measured ${viewName} ${element.type} #${element.index}`, {
      widthInches: widthInches.toFixed(2),
      heightInches: heightInches.toFixed(2),
      widthRatio: widthRatio !== null ? widthRatio.toFixed(2) : null,
      heightRatio: heightRatio !== null ? heightRatio.toFixed(2) : null,
      category: chargeDetail.category,
    });

    charges.push(chargeDetail);
  });

  return charges;
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
  const grid = clothingDefinition?.grid ?? null;

  const designCharges: DesignChargeDetail[] = [];
  (['Front', 'Back'] as DesignViewName[]).forEach((viewName, index) => {
    const details = classifyDesignCategory(viewName, designState ?? null, designPreviews, grid, ppi, logger);
    if (!details.length) return;
    const multiplier = index === 1 ? SECOND_SIDE_DISCOUNT : 1;
    details.forEach((detail) => {
      const charge = roundCurrency(detail.basePrice * multiplier);
      designCharges.push({
        ...detail,
        multiplier,
        charge,
      });
      logger?.(`Applied ${index === 0 ? 'primary' : 'secondary'} ${detail.category} design charge`, {
        view: viewName,
        elementIndex: detail.elementIndex,
        elementType: detail.elementType,
        base: detail.basePrice,
        multiplier,
        charge,
      });
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
