export type PreviewView = 'Front' | 'Back';

export type PreviewCandidateBuckets = {
  frontWithShirt: string[];
  backWithShirt: string[];
  frontWithoutShirt: string[];
  backWithoutShirt: string[];
};

const PREVIEW_SAMPLE_LENGTH = 96;

export function normalizePreview(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function dedupePreviewList(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizePreview(candidate);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function preferNonBlobSources(candidates: Array<string | null | undefined>): string[] {
  const normalized = candidates
    .map((candidate) => normalizePreview(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));
  if (!normalized.length) return [];

  const dataUrls = normalized.filter((candidate) => candidate.startsWith('data:'));
  const otherNonBlob = normalized.filter(
    (candidate) => !candidate.startsWith('data:') && !candidate.startsWith('blob:'),
  );
  const blobUrls = normalized.filter((candidate) => candidate.startsWith('blob:'));

  if (dataUrls.length) {
    // Prioritize inline base64 previews so checkout always receives self-contained sources.
    return [...dataUrls, ...otherNonBlob, ...blobUrls];
  }

  if (otherNonBlob.length) {
    // Prefer non-blob (remote/cache) first, but keep blob URLs as fallback
    return [...otherNonBlob, ...blobUrls];
  }

  return blobUrls;
}

export function describePreviewSource(source: string | null | undefined): string {
  const normalized = normalizePreview(source);
  if (!normalized) return '<empty>';
  let label = 'local';
  if (normalized.startsWith('cache://')) label = 'cache';
  else if (normalized.startsWith('data:')) label = 'data';
  else if (normalized.startsWith('blob:')) label = 'blob';
  else if (normalized.startsWith('http://') || normalized.startsWith('https://')) label = 'remote';
  const sample = normalized.length > PREVIEW_SAMPLE_LENGTH
    ? `${normalized.slice(0, PREVIEW_SAMPLE_LENGTH)}…`
    : normalized;
  return `[${label}] ${sample}`;
}

export function logPreviewBuckets(
  label: string,
  buckets: PreviewCandidateBuckets,
  details?: Record<string, unknown>,
) {
  try {
    console.groupCollapsed(`[PreviewPipeline] ${label}`);
    const summaryRows = [
      ['frontWithShirt', buckets.frontWithShirt],
      ['backWithShirt', buckets.backWithShirt],
      ['frontWithoutShirt', buckets.frontWithoutShirt],
      ['backWithoutShirt', buckets.backWithoutShirt],
    ].map(([slot, list]) => ({
      slot,
      count: Array.isArray(list) ? list.length : 0,
      first: Array.isArray(list) && list.length ? describePreviewSource(list[0]) : '<none>',
    }));
    console.table(summaryRows);
    if (details) {
      console.log('context', details);
    }
    console.groupEnd();
  } catch (error) {
    console.warn('[PreviewPipeline] Failed to log preview buckets', error, { label, buckets, details });
  }
}
