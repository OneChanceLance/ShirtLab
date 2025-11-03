export interface SizeMeasurementSpec {
  key: string;
  type: string;
  unit: string;
  value: number;
  valueInInches: number | null;
}

export interface SizeMeasurementEntry {
  sizeLabel: string;
  normalizedLabel: string;
  specs: SizeMeasurementSpec[];
}

const UNIT_INCHES = ['in', 'inch', 'inches'];
const UNIT_CENTIMETERS = ['cm', 'centimeters', 'centimetres'];
const UNIT_MILLIMETERS = ['mm', 'millimeters', 'millimetres'];
const UNIT_METERS = ['m', 'meter', 'meters', 'metre', 'metres'];

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function normalizeSizeLabel(value: unknown): string {
  const clean = normalizeString(value).toUpperCase();
  return clean.replace(/[^A-Z0-9]+/g, '');
}

function normalizeSpecType(value: unknown): string {
  const clean = normalizeString(value).toLowerCase();
  return clean.replace(/[^a-z0-9]+/g, '_');
}

function parseMeasurementValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  let cleaned = raw.trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/["”]/g, '');
  cleaned = cleaned.replace(/\b(?:inches?|inch|in)\.?$/i, '').trim();
  cleaned = cleaned.replace(/-/g, ' ');

  const decimalMatch = cleaned.match(/^([+-]?\d+(?:\.\d+)?)$/);
  if (decimalMatch) {
    return Number.parseFloat(decimalMatch[1]);
  }

  const mixedMatch = cleaned.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number.parseInt(mixedMatch[1], 10);
    const numerator = Number.parseInt(mixedMatch[2], 10);
    const denominator = Number.parseInt(mixedMatch[3], 10);
    if (!Number.isFinite(denominator) || denominator === 0) return null;
    const fraction = numerator / denominator;
    return whole >= 0 ? whole + fraction : whole - fraction;
  }

  const fractionMatch = cleaned.match(/^([+-]?)(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const sign = fractionMatch[1] === '-' ? -1 : 1;
    const numerator = Number.parseInt(fractionMatch[2], 10);
    const denominator = Number.parseInt(fractionMatch[3], 10);
    if (!Number.isFinite(denominator) || denominator === 0) return null;
    return sign * (numerator / denominator);
  }

  const fallback = Number(cleaned.replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(fallback) ? fallback : null;
}

function convertToInches(value: number, unit: string | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  if (!unit) return value;
  const normalized = unit.toLowerCase();
  if (UNIT_INCHES.includes(normalized)) return value;
  if (UNIT_CENTIMETERS.includes(normalized)) return value / 2.54;
  if (UNIT_MILLIMETERS.includes(normalized)) return value / 25.4;
  if (UNIT_METERS.includes(normalized)) return value * 39.3701;
  return null;
}

function extractSpecArray(rawSpecArray: any): SizeMeasurementSpec[] {
  const list: SizeMeasurementSpec[] = [];
  const specs = Array.isArray(rawSpecArray) ? rawSpecArray : rawSpecArray?.Specification;
  const asArray = Array.isArray(specs) ? specs : [];

  for (const spec of asArray) {
    const rawType = spec?.specificationType ?? spec?.SpecificationType ?? spec?.specificationName ?? spec?.name;
    const rawUnit = spec?.specificationUom ?? spec?.SpecificationUom ?? spec?.uom ?? spec?.unit ?? null;
    const rawValue = spec?.measurementValue ?? spec?.MeasurementValue ?? spec?.value;
    const value = parseMeasurementValue(rawValue);
    if (value === null) continue;

    const key = normalizeSpecType(rawType);
    if (!key) continue;

    const unit = typeof rawUnit === 'string' && rawUnit.trim() ? rawUnit.trim() : 'inches';
    const valueInInches = convertToInches(value, unit);

    list.push({
      key,
      type: normalizeString(rawType) || key,
      unit,
      value,
      valueInInches,
    });
  }

  return list;
}

export function extractSizeMeasurementsFromPromo(rawProduct: any): SizeMeasurementEntry[] {
  const result: SizeMeasurementEntry[] = [];
  if (!rawProduct) return result;

  const parts = rawProduct?.ProductPartArray?.ProductPart;
  const partList: any[] = Array.isArray(parts) ? parts : [];
  const seenSizes = new Set<string>();

  for (const part of partList) {
    const apparelSize = part?.ApparelSize ?? part?.apparelSize ?? {};
    const label = apparelSize?.labelSize ?? apparelSize?.apparelSize ?? apparelSize?.size ?? apparelSize?.label ?? apparelSize?.name;
    const sizeLabel = normalizeString(label);
    if (!sizeLabel) continue;
    const normalizedLabel = normalizeSizeLabel(sizeLabel);
    if (seenSizes.has(normalizedLabel)) continue;

    const specs = extractSpecArray(part?.SpecificationArray ?? part?.specificationArray ?? part?.Specifications);
    if (!specs.length) continue;

    seenSizes.add(normalizedLabel);
    result.push({
      sizeLabel,
      normalizedLabel,
      specs,
    });
  }

  return result;
}

export function findMeasurementForSize(
  entries: SizeMeasurementEntry[] | null | undefined,
  sizeLabel: string | null | undefined,
): SizeMeasurementEntry | undefined {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return undefined;
  if (!sizeLabel) return list[0];
  const normalized = normalizeSizeLabel(sizeLabel);
  return list.find((entry) => entry.normalizedLabel === normalized)
    || list.find((entry) => normalizeSizeLabel(entry.sizeLabel) === normalized)
    || list[0];
}

function findSpecInternal(
  entry: SizeMeasurementEntry | undefined,
  keys: string[],
): SizeMeasurementSpec | undefined {
  if (!entry) return undefined;
  const normalizedKeys = keys.map((key) => normalizeSpecType(key));
  const specs = Array.isArray(entry.specs) ? entry.specs : [];

  for (const spec of specs) {
    if (normalizedKeys.includes(spec.key)) {
      return spec;
    }
  }

  for (const spec of specs) {
    if (normalizedKeys.some((key) => spec.key.includes(key))) {
      return spec;
    }
  }

  for (const spec of specs) {
    const combined = `${spec.type ?? ''} ${spec.key ?? ''}`.toLowerCase();
    if (normalizedKeys.some((key) => combined.includes(key))) {
      return spec;
    }
  }

  return undefined;
}

export function findSpecValueInInches(
  entry: SizeMeasurementEntry | undefined,
  keys: string[],
): number | undefined {
  const spec = findSpecInternal(entry, keys);
  if (!spec) return undefined;
  return spec.valueInInches ?? spec.value;
}

export function findSpecEntry(
  entry: SizeMeasurementEntry | undefined,
  keys: string[],
): SizeMeasurementSpec | undefined {
  return findSpecInternal(entry, keys);
}
