<template>
  <SideMenu :active-menu="props.activeMenu"
    @request-menu="(menu: string, title: string) => emit('request-menu', menu, title)" />
  <CanvasArea>
    <ShirtPlacer ref="shirtPlacerRef" />
  </CanvasArea>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, nextTick, watchEffect, watch } from 'vue';
  import type { ImageObject, TextObject } from './types';
  import CanvasArea from '../canvasArea/CanvasArea.vue';
  import SideMenu from '../sideMenu/SideMenu.vue';
  import ShirtPlacer from './ShirtPlacer.vue';
  import { getClothesByAnyCode, getClothingItemById, getClothingItemByAnyCode } from './clothesDb';

  const props = defineProps<{ activeMenu?: string | null }>();
  const emit = defineEmits<{ (e: 'request-menu', menu: string, title: string): void; }>();

  const DEBUG = false; // flip to false in prod

  const shirtPlacerRef = ref();

  // Only accept messages from these origins
  const ALLOWED_ORIGINS = new Set<string>([
    'https://seeourdesigns.com',
    'https://www.seeourdesigns.com',
    'http://localhost:5173', // dev vite
    'http://127.0.0.1:5173',
  ]);

  function logAllColumns(label: string, obj: any) {
    try {
      const entries = Object.entries(obj || {});
      console.group(label);
      console.log('raw:', obj);
      console.log('column names:', entries.map(([k]) => k));
      const table: Record<string, any> = {};
      for (const [k, v] of entries) table[k] = v;
      console.table(table);
      // also print key-by-key to make it obvious in collapsed logs
      for (const [k, v] of entries) console.log(`${k}:`, v);
      console.groupEnd();
    } catch (err) {
      console.warn('[ShirtLab] logAllColumns failed', err);
    }
  }

  async function handleExternalMessage(ev: MessageEvent) {
    // Security: require known host origin
    if (!ALLOWED_ORIGINS.has(ev.origin)) return;

    const msg = ev.data as any;
    if (DEBUG) console.log('[ShirtLab] message from', ev.origin, msg);
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

    let ok = false;
    try {
      switch (msg.type) {
        case 'shirtlab:set-clothing': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.updateClothing({
            front: p.front,
            back: p.back,
            grid: p.grid,
            bgTransform: p.bgTransform,
          });
          ok = true;
          break;
        }
        case 'shirtlab:set-images': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.setClothingImages({
            front: p.front,
            back: p.back,
          });
          ok = true;
          break;
        }
        case 'shirtlab:set-grid': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.updateClothing({ grid: p });
          ok = true;
          break;
        }
        case 'shirtlab:set-bg': {
          const p = msg.payload || {};
          shirtPlacerRef.value?.setBackgroundTransform({
            offsetX: p.offsetX,
            offsetY: p.offsetY,
            scale: p.scale,
          });
          ok = true;
          break;
        }
        case 'shirtlab:load-product': {
          const p = msg.payload || {};
          ok = await loadProductByCode(String(p.code || ''), Number(p.colorIndex ?? 0));
          break;
        }
      }
    } finally {
      // Send ACK back to the sender (if same-window messaging is supported)
      try {
        const id = msg && typeof msg === 'object' ? msg.id : undefined;
        (ev.source as WindowProxy | null)?.postMessage({
          type: 'shirtlab:ack',
          id,
          ok,
        }, ev.origin);
      } catch { }
    }
  }


  async function loadProductByCode(code: string, colorIndex: number = 0) {
    if (!code) return false;

    // 1) Try clothing_items by code first; if the code happens to be a UUID, also try by id
    try {
      let item = await getClothingItemByAnyCode(code);
      if (!item && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code)) {
        item = await getClothingItemById(code);
      }
      if (item) {
        // Debug: print all columns returned from clothing_items
        logAllColumns(`[ShirtLab] clothing_items row for code ${code}`, item);

        const gridJson: any = item.grid || {};
        const grid = {
          x: Number(gridJson.x ?? 175),
          y: Number(gridJson.y ?? 150),
          w: Number(gridJson.w ?? 250),
          h: Number(gridJson.h ?? 400),
        };

        const colorsArr: any[] = Array.isArray(item.colors) ? item.colors : [];
        const c = colorsArr[colorIndex] ?? colorsArr[0] ?? {};

        const front: string | undefined =
          c.frontUrl || c.frontURL || c.frontImage || c.front || c.imageUrl || undefined;
        const back: string | undefined =
          c.backUrl || c.backURL || c.backImage || c.back || c.imageUrl || undefined;

        const bgs: any = (item as any).backgrounds || {};
        const rootFront = (item as any).frontUrl || (item as any).frontImage || (item as any).imageUrl;
        const rootBack = (item as any).backUrl || (item as any).backImage || (item as any).imageUrl;
        const useFront = front ?? bgs.front ?? rootFront;
        const useBack = back ?? bgs.back ?? rootBack;

        const bgT: any = c.bgTransform || gridJson.bgTransform || {};
        const bgTransform = {
          offsetX: Number(bgT.offsetX ?? 0),
          offsetY: Number(bgT.offsetY ?? 0),
          scale: Number(bgT.scale ?? 1),
        };

        shirtPlacerRef.value?.updateClothing({ front: useFront, back: useBack, grid, bgTransform });
        return true;
      }
    } catch (e) {
      console.warn('[ShirtLab] clothing_items lookup failed (code/id), trying legacy code table', e);
    }

    // 2) Legacy fallback: code-based rows in `clothes`
    try {
      const row = await getClothesByAnyCode(code);
      if (!row) {
        console.info('[ShirtLab] Legacy `clothes` table not present or no row found for code', code);
        return false;
      }

      // Debug: print all columns returned from legacy `clothing`/`clothes`
      logAllColumns(`[ShirtLab] legacy clothing row for code ${code}`, row);

      const front = row.front_url ?? row.image_front ?? undefined;
      const back = row.back_url ?? row.image_back ?? undefined;
      const grid = {
        x: Number(row.grid_x ?? row.print_x ?? 0),
        y: Number(row.grid_y ?? row.print_y ?? 0),
        w: Number(row.grid_w ?? row.print_w ?? 300),
        h: Number(row.grid_h ?? row.print_h ?? 400),
      };
      const bgTransform = {
        offsetX: Number(row.bg_offset_x ?? row.bgX ?? 0),
        offsetY: Number(row.bg_offset_y ?? row.bgY ?? 0),
        scale: Number(row.bg_scale ?? row.bgScale ?? 1),
      };
      shirtPlacerRef.value?.updateClothing({ front, back, grid, bgTransform });
      return true;
    } catch (err: any) {
      if (err && err.code === '42P01') {
        console.info('[ShirtLab] Legacy `clothes` table missing; skipping fallback');
        return false;
      }
      console.error('[ShirtLab] loadProductByCode failed', err);
      return false;
    }
  }

  function applyExternalClothing(payload: {
    front?: string;
    back?: string;
    grid?: any;
    colors?: any[];
    bgTransform?: any;
  }) {
    if (!payload) return;

    const details: any = {};
    if (payload.grid) details.grid = payload.grid;
    if (payload.colors) details.colors = payload.colors;
    if (payload.front) details.front = payload.front;
    if (payload.back) details.back = payload.back;
    const transform = payload.bgTransform ?? payload.colors?.[0]?.bgTransform;
    if (transform) details.bgTransform = transform;

    shirtPlacerRef.value?.updateClothing(details);
  }

  onMounted(async () => {
    window.addEventListener('message', handleExternalMessage);
    // Optional direct API for same-origin host pages
    (window as any).ShirtLab = {
      setClothing: (details: { front?: string; back?: string; grid?: { x: number; y: number; w: number; h: number }; bgTransform?: { offsetX?: number; offsetY?: number; scale?: number } }) =>
        shirtPlacerRef.value?.updateClothing(details),
      setImages: (imgs: { front?: string; back?: string }) =>
        shirtPlacerRef.value?.setClothingImages(imgs),
      setGrid: (grid: { x: number; y: number; w: number; h: number }) =>
        shirtPlacerRef.value?.updateClothing({ grid }),
      setBg: (t: { offsetX?: number; offsetY?: number; scale?: number }) =>
        shirtPlacerRef.value?.setBackgroundTransform(t),
      loadProduct: (code: string, colorIndex: number = 0) => loadProductByCode(code, colorIndex),
    };

    await nextTick();
    // Notify parent that widget is ready (for postMessage handshakes)
    try {
      window.parent?.postMessage({ type: 'shirtlab:ready' }, '*');
    } catch { }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleExternalMessage);
    if ((window as any).ShirtLab) delete (window as any).ShirtLab;
  });

  const selectedObject = computed<TextObject | ImageObject | null>(() => {
    return (shirtPlacerRef.value as any)?.selectedObject ?? null;
  });

  watchEffect(() => {
    const placer = shirtPlacerRef.value as any;
    console.log('[ShirtLab/watchEffect] raw ref ->', placer?.selectedObject);
    console.log('[ShirtLab/watchEffect] selectedObject ->', selectedObject.value);
  });

  watch(
    () => (shirtPlacerRef.value as any)?.selectedObject?.value,
    (val) => {
      console.log('[ShirtLab/watch] selectedObject ->', val);
    },
    { immediate: true }
  );

  function draw() {
    shirtPlacerRef.value?.draw();
  }

  function centerSelectedText() {
    shirtPlacerRef.value?.centerSelectedText();
  }

  function duplicateSelectedText() {
    shirtPlacerRef.value?.duplicateSelectedText?.();
  }

  function bringSelectedForward() {
    shirtPlacerRef.value?.bringSelectedForward?.();
  }

  function sendSelectedBack() {
    shirtPlacerRef.value?.sendSelectedBack?.();
  }

  function updateClothing(details: any) {
    shirtPlacerRef.value?.updateClothing(details);
  }

  function uploadObject(type: string, payload: any) {
    shirtPlacerRef.value?.uploadObject(type, payload);
  }

  defineExpose({
    loadProductByCode,
    applyExternalClothing,
    selectedObject,
    draw,
    centerSelectedText,
    duplicateSelectedText,
    bringSelectedForward,
    sendSelectedBack,
    updateClothing,
    uploadObject,
  });
</script>
