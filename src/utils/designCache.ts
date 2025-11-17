import { changeDpiDataUrl } from 'changedpi';
const DB_NAME = 'shirtlab-design-cache';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

export const CACHE_REF_PREFIX = 'cache://design/';
type CacheKey = string;

export type CachedAssetRef = `${typeof CACHE_REF_PREFIX}${string}`;

let openPromise: Promise<IDBDatabase> | null = null;
const objectUrlMap = new Map<CachedAssetRef, string>();
const reverseObjectUrlMap = new Map<string, CachedAssetRef>();

function ensureBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function toCacheRef(key: CacheKey): CachedAssetRef {
  return `${CACHE_REF_PREFIX}${key}` as CachedAssetRef;
}

function fromCacheRef(ref: CachedAssetRef): CacheKey {
  return ref.slice(CACHE_REF_PREFIX.length);
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!ensureBrowser()) {
    throw new Error('designCache is only available in the browser');
  }
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
  return openPromise;
}

function generateKey(context: string | undefined, mime: string | undefined): CacheKey {
  const safeContext = context?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'asset';
  const suffix = Math.random().toString(36).slice(2, 10);
  let extRaw = (mime?.split('/')[1] || '').toLowerCase();
  if (extRaw.includes('svg')) extRaw = 'svg';
  if (extRaw.startsWith('jpeg')) extRaw = 'jpg';
  const ext = extRaw.replace(/[^a-z0-9]+/gi, '') || 'img';
  const timestamp = Date.now().toString(36);
  return `${safeContext}-${timestamp}-${suffix}.${ext}`;
}

export function isCachedAssetRef(value: unknown): value is CachedAssetRef {
  return typeof value === 'string' && value.startsWith(CACHE_REF_PREFIX) && value.length > CACHE_REF_PREFIX.length;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  console.log('[designCache] full dataUrl before blob:', dataUrl);
  const comma = dataUrl.indexOf(',');

  if (comma < 0) {
    throw new Error('Invalid data URL: missing comma');
  }

  const header = dataUrl.slice(0, comma);
  let payload = dataUrl.slice(comma + 1);
  console.log('[designCache] base64 payload before blob:', payload);
  // Parse "data:[<mime>][;param]*,...."
  const match = header.match(/^data:([^;,]+)?((?:;[^,;]+)*)$/i);
  const mime = (match?.[1] || 'application/octet-stream').toLowerCase();
  const params = match?.[2] || '';
  const isBase64 = /;base64\b/i.test(params);

  if (isBase64) {
    // url-safe → standard
    payload = payload.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const mod = payload.length % 4;
    if (mod) payload += '='.repeat(4 - mod);

    const bin = atob(payload);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: mime });
  }

  // Non-base64 branch (e.g., data:image/svg+xml;utf8,<svg ...>)
  let text: string;
  try {
    text = decodeURIComponent(payload);
  } catch {
    // If it's not percent-encoded, use raw
    text = payload;
  }

  if (typeof TextEncoder !== 'undefined') {
    const enc = new TextEncoder();
    return new Blob([enc.encode(text)], { type: mime });
  }
  return new Blob([text], { type: mime });
}

export async function storeDataUrlInCache(dataUrl: string, context?: string): Promise<CachedAssetRef | null> {
  if (!ensureBrowser()) return null;
  if (!dataUrl.startsWith('data:')) return null;
  try {
    const processed = changeDpiDataUrl(dataUrl, 300);
    const blob = dataUrlToBlob(processed);
    const key = generateKey(context, blob.type);
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(blob, key);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        const err = request.error;
        if (err && err.name === 'QuotaExceededError') {
          console.warn('[designCache] Quota exceeded; skipping cache for', context);
          resolve(); // or reject, but don't treat as fatal
          return;
        }
        reject(err ?? new Error('Failed to cache asset'));
      };


    });
    return toCacheRef(key);
  } catch (error) {
    console.warn('[designCache] Failed to store data URL for', context, " ", dataUrl, " ", error);
    return null;
  }
}

export async function getCachedBlob(ref: CachedAssetRef): Promise<Blob | null> {
  if (!ensureBrowser()) return null;
  try {
    const key = fromCacheRef(ref);
    const db = await openDatabase();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result instanceof Blob) {
          resolve(result);
        } else if (result) {
          resolve(new Blob([result]));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read cached asset'));
    });
  } catch (error) {
    console.warn('[designCache] Failed to read cached asset', error);
    return null;
  }
}

export async function createObjectUrlFromCache(ref: CachedAssetRef): Promise<string | null> {
  if (!ensureBrowser()) return null;
  if (objectUrlMap.has(ref)) {
    return objectUrlMap.get(ref) ?? null;
  }
  const blob = await getCachedBlob(ref);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrlMap.set(ref, url);
  reverseObjectUrlMap.set(url, ref);
  return url;
}

export function revokeCachedObjectUrl(ref: CachedAssetRef) {
  const existing = objectUrlMap.get(ref);
  if (existing) {
    URL.revokeObjectURL(existing);
    objectUrlMap.delete(ref);
    reverseObjectUrlMap.delete(existing);
  }
}

export async function removeCachedAsset(ref: CachedAssetRef): Promise<void> {
  if (!ensureBrowser()) return;
  try {
    const key = fromCacheRef(ref);
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to delete cached asset'));
    });
  } catch (error) {
    console.warn('[designCache] Failed to remove cached asset', error);
  } finally {
    revokeCachedObjectUrl(ref);
  }
}

export async function resolveCachedAsDataUrl(ref: CachedAssetRef): Promise<string | null> {
  if (!ensureBrowser()) return null;
  const blob = await getCachedBlob(ref);
  if (!blob) return null;
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read cached blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Re-hydrate a cached asset into a fresh IndexedDB entry.
 *
 * Useful when you want to:
 *   1. Read the existing cached blob as a data URL (data64),
 *   2. Run it back through the same DPI-stamping + Blob pipeline,
 *   3. Store it again and get a new cache ref.
 *
 * The original cache entry is left intact; callers can decide whether to
 * keep or purge it via `removeCachedAsset`.
 */
export async function recacheAssetFromRef(
  ref: CachedAssetRef,
  context?: string,
): Promise<CachedAssetRef | null> {
  if (!ensureBrowser()) return null;
  try {
    const dataUrl = await resolveCachedAsDataUrl(ref);
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return null;
    }
    const nextRef = await storeDataUrlInCache(dataUrl, context);
    return nextRef;
  } catch (error) {
    console.warn('[designCache] Failed to recache asset from ref', { ref, context }, error);
    return null;
  }
}

export function getCachedObjectUrl(ref: CachedAssetRef): string | null {
  return objectUrlMap.get(ref) ?? null;
}

export async function touchCachedObjectUrl(ref: CachedAssetRef): Promise<string | null> {
  const cached = getCachedObjectUrl(ref);
  if (cached) {
    reverseObjectUrlMap.set(cached, ref);
    return cached;
  }
  return await createObjectUrlFromCache(ref);
}

export function resolveCachedRefFromObjectUrl(url: string): CachedAssetRef | null {
  if (!url || typeof url !== 'string') return null;
  return reverseObjectUrlMap.get(url) ?? null;
}

export function registerObjectUrlForRef(ref: CachedAssetRef, url: string) {
  if (!ref || !url) return;
  objectUrlMap.set(ref, url);
  reverseObjectUrlMap.set(url, ref);
}
