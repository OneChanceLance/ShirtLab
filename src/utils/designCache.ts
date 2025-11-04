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
  const ext = mime?.split('/')[1]?.replace(/[^a-z0-9]+/gi, '') || 'img';
  const timestamp = Date.now().toString(36);
  return `${safeContext}-${timestamp}-${suffix}.${ext}`;
}

export function isCachedAssetRef(value: unknown): value is CachedAssetRef {
  return typeof value === 'string' && value.startsWith(CACHE_REF_PREFIX) && value.length > CACHE_REF_PREFIX.length;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  if (!header || !base64) {
    throw new Error('Invalid data URL');
  }
  const mimeMatch = header.match(/data:(.*?)(;base64)?$/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const length = binary.length;
  const buffer = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

export async function storeDataUrlInCache(dataUrl: string, context?: string): Promise<CachedAssetRef | null> {
  if (!ensureBrowser()) return null;
  if (!dataUrl.startsWith('data:')) return null;
  try {
    const blob = dataUrlToBlob(dataUrl);
    const key = generateKey(context, blob.type);
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(blob, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to cache asset'));
    });
    return toCacheRef(key);
  } catch (error) {
    console.warn('[designCache] Failed to store data URL', error);
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
