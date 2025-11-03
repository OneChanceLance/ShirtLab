import type { CartItemDesignPreviews } from '../stores/cart';
import type { DesignViewName, SerializedDesignState } from '../types/designState';
import { getAABB } from '../components/shirtlab/utils/geometry';

// --- Element identity metadata (cross-file contract) ---
type ElementTypeKind = 'image' | 'text' | 'icon' | 'shape';
type ElementVariantKind = string; // e.g., 'bitmap' | 'svg' | 'square' | 'circle' | font family, etc.

interface ElementInventorySummary {
  index: number;
  type: 'image' | 'text';
  elementType?: ElementTypeKind;
  elementVariant?: ElementVariantKind;
  name?: string | null;
  x: number;
  y: number;
  rotation: number;
  widthInches: number;
  heightInches: number;
  areaSquareInches: number;
}

export type DesignCategory = 'full' | 'left';

export interface DesignChargeDetail {
  view: DesignViewName;
  elementIndex?: number;
  elementType?: 'image' | 'text' | 'icon' | 'shape' | 'composite';
  category: DesignCategory;
  basePrice: number;
  multiplier: number;
  charge: number;
  widthInches?: number;
  heightInches?: number;
  areaSquareInches?: number;
  coverageRatio?: number;
  source: 'bounds' | 'preview';
  items?: ElementInventorySummary[];
  elementsCount?: number;
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
const DESIGN_LARGE_PRICE = 15;
const DESIGN_SMALL_PRICE = 10;
const SECOND_SIDE_DISCOUNT = 1;
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
  x: number;
  y: number;
  rotation: number;
  elementType?: ElementTypeKind;
  elementVariant?: ElementVariantKind;
  name?: string | null;
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
        x: toNumber((img as any)?.x) ?? 0,
        y: toNumber((img as any)?.y) ?? 0,
        rotation: toNumber((img as any)?.rotation) ?? 0,
        elementType: (img as any)?.elementType ?? ((img as any)?.shapeMeta?.kind ? 'shape' : 'image'),
        elementVariant: (img as any)?.elementVariant ?? (img as any)?.shapeMeta?.kind ?? ((img as any)?.vectorHint ? 'svg' : 'bitmap'),
        name: (img as any)?.name ?? (img as any)?.label ?? null,
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
        x: toNumber((txt as any)?.x) ?? 0,
        y: toNumber((txt as any)?.y) ?? 0,
        rotation: toNumber((txt as any)?.rotation) ?? 0,
        elementType: (txt as any)?.elementType ?? 'text',
        elementVariant: (txt as any)?.elementVariant ?? (txt as any)?.font ?? (txt as any)?.fontFamily ?? undefined,
        name: (txt as any)?.name ?? (txt as any)?.text ?? null,
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

  const gridWidthEstimateInches = gridWidthInches && gridWidthInches > 0
    ? gridWidthInches
    : gridWidthPx && gridWidthPx > 0
      ? gridWidthPx / gridPpi
      : null;
  const gridHeightEstimateInches = gridHeightInches && gridHeightInches > 0
    ? gridHeightInches
    : gridHeightPx && gridHeightPx > 0
      ? gridHeightPx / gridPpi
      : null;
  const gridAreaInches = gridWidthEstimateInches && gridHeightEstimateInches
    ? gridWidthEstimateInches * gridHeightEstimateInches
    : null;

  const elements = extractDesignElements(designState?.views?.[viewName]);
  const trimmedPreview = previews?.[viewName];
  const hasPreview = typeof trimmedPreview === 'string' && trimmedPreview.trim().length > 0;
  const charges: DesignChargeDetail[] = [];

  if (!elements.length) {
    if (!hasPreview) {
      logger?.(`❌ No ${viewName} design detected.`);
      return charges;
    }
    logger?.(`Detected ${viewName} preview without bounds; treating as small-area charge.`, { view: viewName });
    charges.push({
      view: viewName,
      category: 'left',
      basePrice: DESIGN_SMALL_PRICE,
      multiplier: 1,
      charge: DESIGN_SMALL_PRICE,
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
    if (ppi && Number.isFinite(ppi) && ppi > 0) {
      return boundsPx / ppi;
    }
    if (gridPx && gridPx > 0 && gridInches && gridInches > 0) {
      const ratio = boundsPx / gridPx;
      return ratio * gridInches;
    }
    return boundsPx / DEFAULT_PIXELS_PER_INCH;
  };

  const areaThresholdSqInches = DESIGN_PRICE_THRESHOLD_INCHES * DESIGN_PRICE_THRESHOLD_INCHES;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const inventory: ElementInventorySummary[] = [];

  elements.forEach((element) => {
    const widthInches = computeDimension(element.widthPx, gridWidthPx, gridWidthInches, gridPpi);
    const heightInches = computeDimension(element.heightPx, gridHeightPx, gridHeightInches, gridPpi);
    const areaInches = widthInches * heightInches;
    inventory.push({
      index: element.index,
      type: element.type,
      elementType: element.elementType,
      elementVariant: element.elementVariant,
      name: element.name ?? null,
      x: element.x,
      y: element.y,
      rotation: element.rotation ?? 0,
      widthInches,
      heightInches,
      areaSquareInches: areaInches,
    });

    const aabb = getAABB({
      x: element.x,
      y: element.y,
      w: element.widthPx,
      h: element.heightPx,
      rotation: element.rotation ?? 0,
    });

    if (aabb.minX < minX) minX = aabb.minX;
    if (aabb.minY < minY) minY = aabb.minY;
    if (aabb.maxX > maxX) maxX = aabb.maxX;
    if (aabb.maxY > maxY) maxY = aabb.maxY;
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    logger?.(`Unable to determine bounds for ${viewName}; falling back to preview pricing.`);
    charges.push({
      view: viewName,
      category: 'left',
      basePrice: DESIGN_SMALL_PRICE,
      multiplier: 1,
      charge: DESIGN_SMALL_PRICE,
      source: 'bounds',
    });
    return charges;
  }

  const sumAABBInchesSq = inventory.reduce((acc, it) => acc + (Number.isFinite(it.areaSquareInches) ? it.areaSquareInches : 0), 0);

  const boundingWidthPx = Math.max(0, maxX - minX);
  const boundingHeightPx = Math.max(0, maxY - minY);

  const boundingWidthInches = computeDimension(boundingWidthPx, gridWidthPx, gridWidthInches, gridPpi);
  const boundingHeightInches = computeDimension(boundingHeightPx, gridHeightPx, gridHeightInches, gridPpi);
  const boundingAreaInches = boundingWidthInches * boundingHeightInches;

  if (!Number.isFinite(boundingAreaInches) || boundingAreaInches <= 0) {
    logger?.(`Combined bounds for ${viewName} produced no measurable area; applying minimum charge.`);
    charges.push({
      view: viewName,
      category: 'left',
      basePrice: DESIGN_SMALL_PRICE,
      multiplier: 1,
      charge: DESIGN_SMALL_PRICE,
      source: 'bounds',
    });
    return charges;
  }

  const widthRatio = gridWidthPx && gridWidthPx > 0 ? boundingWidthPx / gridWidthPx : null;
  const heightRatio = gridHeightPx && gridHeightPx > 0 ? boundingHeightPx / gridHeightPx : null;
  const areaCoverageRatio = gridAreaInches && gridAreaInches > 0
    ? Math.min(1, boundingAreaInches / gridAreaInches)
    : null;

  const isLarge =
    boundingAreaInches >= areaThresholdSqInches ||
    (typeof areaCoverageRatio === 'number' && areaCoverageRatio >= FULL_GRID_RATIO_THRESHOLD);

  const base = isLarge ? DESIGN_LARGE_PRICE : DESIGN_SMALL_PRICE;
  const coverageForDetail = typeof areaCoverageRatio === 'number'
    ? areaCoverageRatio
    : Math.max(
      typeof widthRatio === 'number' ? widthRatio : 0,
      typeof heightRatio === 'number' ? heightRatio : 0,
    );

  logger?.('design:view-report', {
    view: viewName,
    summary: {
      bounds: {
        widthInches: boundingWidthInches,
        heightInches: boundingHeightInches,
        areaSquareInches: boundingAreaInches,
      },
      coverageRatio: coverageForDetail,
      priceTier: isLarge ? 'large' : 'small',
      sumAABBInchesSq,
      elementsCount: inventory.length,
      grid: {
        widthInches: gridWidthEstimateInches,
        heightInches: gridHeightEstimateInches,
        areaSquareInches: gridAreaInches ?? null,
      },
    },
    items: inventory.map((it) => ({
      index: it.index,
      elementType: it.elementType ?? it.type,
      elementVariant: it.elementVariant ?? null,
      name: it.name ?? '',
      widthInches: it.widthInches,
      heightInches: it.heightInches,
      areaSquareInches: it.areaSquareInches,
      position: { x: it.x, y: it.y },
      rotation: it.rotation,
    })),
  });

  charges.push({
    view: viewName,
    elementType: 'composite',
    category: isLarge ? 'full' : 'left',
    basePrice: base,
    multiplier: 1,
    charge: base,
    widthInches: boundingWidthInches,
    heightInches: boundingHeightInches,
    areaSquareInches: boundingAreaInches,
    coverageRatio: coverageForDetail,
    source: 'bounds',
    items: inventory,
    elementsCount: inventory.length,
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
      logger?.(`✅ Applied ${index === 0 ? 'primary' : 'secondary'} ${detail.category} design charge`, {
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
