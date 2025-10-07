import { ref } from 'vue';
import type { ColorOption } from '../../shirtlab/types';

export const COLOR_OPTIONS: Record<string, ColorOption> = {
    'None': { name: 'None', color: '#00000001' },
    'White': { name: 'White', color: '#ffffffff' },
    'Black': { name: 'Black', color: '#000000ff' },

    'Gray': { name: 'Gray', color: '#6f7372' },
    'Light Gray': { name: 'Light Gray', color: '#979697' },
    'Purple Pink': { name: 'Purple Pink', color: '#cd629b' },
    'Hot Pink': { name: 'Hot Pink', color: '#ee529b' },
    'Light Pink': { name: 'Light Pink', color: '#f190b2' },
    'Dark Pink': { name: 'Dark Pink', color: '#c75994' },
    'Wine Purple': { name: 'Wine Purple', color: '#883152' },
    'Dark Wine Red': { name: 'Dark Wine Red', color: '#831e33' },
    'Crimson': { name: 'Crimson', color: '#b11a2a' },
    'Scarlet Red': { name: 'Scarlet Red', color: '#c11c29' },
    'Bright Red': { name: 'Bright Red', color: '#e83235' },
    'Orange Red': { name: 'Orange Red', color: '#ee5625' },
    'Bright Orange': { name: 'Bright Orange', color: '#f58c29' },
    'Yellow Orange': { name: 'Yellow Orange', color: '#fbb531' },
    'Bright Yellow': { name: 'Bright Yellow', color: '#fbcd32' },
    'Brown Yellow': { name: 'Brown Yellow', color: '#bd9e2c' },
    'Light Sage': { name: 'Light Sage', color: '#929f72' },
    'Lime Green': { name: 'Lime Green', color: '#9fce6d' },
    'Grass Green': { name: 'Grass Green', color: '#60af44' },
    'Forest Green': { name: 'Forest Green', color: '#23753c' },
    'Dark Green': { name: 'Dark Green', color: '#265132' },
    'Deep Green': { name: 'Deep Green', color: '#2c4b31' },
    'Teal': { name: 'Teal', color: '#1e727b' },
    'Cyan Blue': { name: 'Cyan Blue', color: '#2f93b3' },
    'Sky Blue': { name: 'Sky Blue', color: '#5ca7d5' },
    'Steel Blue': { name: 'Steel Blue', color: '#6490bc' },
    'Royal Blue': { name: 'Royal Blue', color: '#2d5797' },
    'Dark Royal Blue': { name: 'Dark Royal Blue', color: '#284487' },
    'Navy Blue': { name: 'Navy Blue', color: '#193461' },
    'Lavender Gray': { name: 'Lavender Gray', color: '#645687' },
    'Orchid Purple': { name: 'Orchid Purple', color: '#9c4e99' },
    'Plum': { name: 'Plum', color: '#693082' },
    'Dark Plum': { name: 'Dark Plum', color: '#572365' },
    'Eggplant Purple': { name: 'Eggplant Purple', color: '#5b215c' },
    'Dark Brown': { name: 'Dark Brown', color: '#4d3523' },
    'Medium Brown': { name: 'Medium Brown', color: '#865636' },
    'Tan Brown': { name: 'Tan Brown', color: '#ac7950' },
    'Light Tan': { name: 'Light Tan', color: '#dda56e' },
    'Peach': { name: 'Peach', color: '#f0c187' },
    'Beige': { name: 'Beige', color: '#c9b894' }
};

export const PRODUCT_COLORS = ref<any[]>([]);
export const selectedProductColorIndex = ref(0);
export const selectedProductSize = ref<string | null>(null);

const SIZE_ORDER = [
  'NB',
  '3M', '6M', '9M', '12M', '18M', '24M',
  '2T', '3T', '4T', '5T',
  'YXS', 'YS', 'YM', 'YL', 'YXL',
  'XXXS', 'XXS', 'XS', 'XS/S',
  'S', 'S/M',
  'M', 'M/L',
  'L', 'L/XL',
  'XL', 'XL/2XL', 'XLT',
  '1X', '1XL',
  '2XL', '2XL/3XL', '2XLT',
  '3XL', '3XL/4XL', '3XLT',
  '4XL', '4XL/5XL',
  '5XL', '6XL', '7XL', '8XL',
  'OS',
] as const;

const SIZE_PRIORITY = new Map<string, number>(SIZE_ORDER.map((code, idx) => [code, idx]));

const SIZE_ALIASES: Record<string, string> = {
  'SM': 'S',
  'SMALL': 'S',
  'SML': 'S',
  'S/P': 'S',
  'SMALLMEDIUM': 'S/M',
  'SM/MD': 'S/M',
  'SMALL/MEDIUM': 'S/M',
  'MEDIUM': 'M',
  'MED': 'M',
  'MD': 'M',
  'M/LARGE': 'M/L',
  'ML': 'M/L',
  'MEDIUM/LARGE': 'M/L',
  'LARGE': 'L',
  'LG': 'L',
  'LRG': 'L',
  'L/XLARGE': 'L/XL',
  'L/XL': 'L/XL',
  'LARGE/XLARGE': 'L/XL',
  'XLARGE': 'XL',
  'X-LARGE': 'XL',
  'EXTRALARGE': 'XL',
  'XLG': 'XL',
  'X-LARGE/TALL': 'XLT',
  'XL/TALL': 'XLT',
  'XLTALL': 'XLT',
  '1X': '1XL',
  '1XL/2XL': 'XL/2XL',
  '2X': '2XL',
  'XXL': '2XL',
  'XX-LARGE': '2XL',
  '2XLARGE': '2XL',
  '2X-LARGE': '2XL',
  '2X/TALL': '2XLT',
  '2XLT': '2XLT',
  '3X': '3XL',
  'XXXL': '3XL',
  'XXX-LARGE': '3XL',
  '3XLARGE': '3XL',
  '3X/TALL': '3XLT',
  '3XLT': '3XLT',
  '4X': '4XL',
  'XXXXL': '4XL',
  '4XLARGE': '4XL',
  '4XL/5XL': '4XL/5XL',
  '5X': '5XL',
  'XXXXXL': '5XL',
  '6X': '6XL',
  'XXXXXXL': '6XL',
  '7X': '7XL',
  '8X': '8XL',
  'OSFA': 'OS',
  'OSFM': 'OS',
  'ONESIZE': 'OS',
};

export function normalizeSizeToken(value: string): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const collapsed = trimmed.toUpperCase().replace(/\s+/g, '');
  return SIZE_ALIASES[collapsed] ?? collapsed;
}

function sizeRank(value: string): number {
  const normalized = normalizeSizeToken(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const ranked = SIZE_PRIORITY.get(normalized);
  if (ranked !== undefined) return ranked;
  if (normalized.endsWith('T')) {
    const base = normalized.slice(0, -1);
    const baseRank = SIZE_PRIORITY.get(base);
    if (baseRank !== undefined) return baseRank + 0.25;
  }
  const numericMatch = normalized.match(/^(\d+)(X+)L$/);
  if (numericMatch) {
    const steps = Math.max(Number.parseInt(numericMatch[1], 10), numericMatch[2].length);
    const baseRank = SIZE_PRIORITY.get('XL');
    if (baseRank !== undefined) return baseRank + steps;
  }
  return Number.POSITIVE_INFINITY;
}

export function compareSizes(a: string, b: string): number {
  const rankA = sizeRank(a);
  const rankB = sizeRank(b);
  const aIsFinite = Number.isFinite(rankA);
  const bIsFinite = Number.isFinite(rankB);
  if (aIsFinite && bIsFinite && rankA !== rankB) {
    return rankA - rankB;
  }
  if (aIsFinite && !bIsFinite) return -1;
  if (!aIsFinite && bIsFinite) return 1;
  const normA = normalizeSizeToken(a);
  const normB = normalizeSizeToken(b);
  return normA.localeCompare(normB);
}

export function extractColorSizes(color: any): string[] {
  if (!color) return [];
  const list = Array.isArray(color?.sizes) ? color.sizes : [];
  const unique = new Map<string, string>();
  for (const entry of list) {
    if (entry === null || entry === undefined) continue;
    let raw: any = entry;
    if (typeof entry === 'object' && entry !== null) {
      if ('size' in entry && entry.size !== undefined && entry.size !== null) {
        raw = (entry as any).size;
      } else if ('label' in entry && entry.label !== undefined && entry.label !== null) {
        raw = (entry as any).label;
      }
    }
    let label = '';
    if (typeof raw === 'string') {
      label = raw.trim();
    } else if (Number.isFinite(raw)) {
      label = String(raw);
    }
    if (!label) continue;
    const normalized = normalizeSizeToken(label);
    const key = normalized || label.toUpperCase();
    if (!unique.has(key)) {
      unique.set(key, label);
    }
  }
  const deduped = Array.from(unique.values());
  deduped.sort(compareSizes);
  return deduped;
}

export function findMatchingSize(target: string | null, sizes: string[]): string | null {
  if (!target) return null;
  const normalizedTarget = normalizeSizeToken(target);
  if (!normalizedTarget) return null;
  const match = sizes.find((size) => normalizeSizeToken(size) === normalizedTarget);
  return match ?? null;
}

export interface ColorSelectionOptions {
  /**
   * Invoked when the previously selected size is unavailable in the new color.
   */
  onSizeUnavailable?: (payload: {
    requestedSize: string;
    colorName: string;
    colorIndex: number;
    availableSizes: string[];
    color: any;
  }) => void;
  /**
   * Skip synchronising the size state.
   */
  skipSizeSync?: boolean;
}

export function setProductColors(colors: any[]) {
  PRODUCT_COLORS.value = Array.isArray(colors) ? colors : [];
  if (!PRODUCT_COLORS.value.length) {
    selectedProductColorIndex.value = 0;
    selectedProductSize.value = null;
  } else if (selectedProductColorIndex.value >= PRODUCT_COLORS.value.length) {
    selectedProductColorIndex.value = 0;
  } else if (selectedProductColorIndex.value < 0) {
    selectedProductColorIndex.value = 0;
  }
}

export function setSelectedProductColorIndex(index: number, options?: ColorSelectionOptions) {
  const colors = PRODUCT_COLORS.value;
  const hasColors = Array.isArray(colors) && colors.length > 0;
  const length = hasColors ? colors.length : 0;
  const bounded = Number.isFinite(index) ? Math.max(0, Math.min(Math.floor(index), Math.max(0, length - 1))) : 0;
  selectedProductColorIndex.value = bounded;
  if (options?.skipSizeSync) return;

  if (!hasColors) {
    if (selectedProductSize.value !== null) setSelectedProductSize(null);
    return;
  }

  const previousSize = selectedProductSize.value;
  const color = colors[bounded];
  const sizes = extractColorSizes(color);
  const matched = findMatchingSize(previousSize, sizes);

  if (matched) {
    if (matched !== previousSize) setSelectedProductSize(matched);
    return;
  }

  if (previousSize && options?.onSizeUnavailable) {
    const colorName = typeof color?.name === 'string' && color.name.trim()
      ? color.name.trim()
      : `Color ${bounded + 1}`;
    options.onSizeUnavailable({
      requestedSize: previousSize,
      colorName,
      colorIndex: bounded,
      availableSizes: sizes,
      color,
    });
  }
  if (!sizes.length && previousSize !== null) {
    setSelectedProductSize(null);
  }
}

export function setSelectedProductSize(size: string | null) {
  selectedProductSize.value = size ?? null;
}
