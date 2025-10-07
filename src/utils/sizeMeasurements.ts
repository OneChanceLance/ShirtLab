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

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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
    const value = toNumber(rawValue);
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

export function findSpecValueInInches(
  entry: SizeMeasurementEntry | undefined,
  keys: string[],
): number | undefined {
  if (!entry) return undefined;
  const normalizedKeys = keys.map((key) => normalizeSpecType(key));
  for (const spec of entry.specs) {
    if (normalizedKeys.includes(spec.key)) {
      return spec.valueInInches ?? spec.value;
    }
  }
  return undefined;
}
