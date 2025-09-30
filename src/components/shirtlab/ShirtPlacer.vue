<template>
  <div class="page">
    <div class="lab-container" style="position:relative;">
      <input ref="fileInput" type="file" accept="image/*" multiple @change="onFileChange" style="display:none;" />

      <canvas ref="canvas" :width="canvasWidth" :height="canvasHeight" style="display:block;"
        :style="{ cursor: canvasCursor }" @mousedown="startDrag" @mousemove="onMove" @mouseup="stopDrag" />
      <!-- Vue icon handles for selected image -->
      <div v-if="selectedObject && selectedObject.type === 'image'">
        <div class="canvas" v-for="(handle, index) in ['delete', 'resize', 'duplicate', 'rotate']" :key="handle" :style="{
          left: getHandlePosition(index).x + 'px',
          top: getHandlePosition(index).y + 'px',
          cursor: index === 1 ? 'nesw-resize' : 'pointer',
          pointerEvents: (selectedObject && selectedObject.type === 'image') ? 'auto' : 'none'
        }" @click="handleImageClick(index)" @mousedown="handleMouseDown(index, $event)" @mouseup="stopDrag">
          <component :is="iconComponents[index]" />
        </div>
      </div>
      <div v-if="selectedObject && selectedObject.type === 'text' && selectedObject.showHandles === true">
        <!-- Delete: top-left -->
        <div class="canvas" :style="{
          left: getTextHandlePosition('topLeft').left + 'px',
          top: getTextHandlePosition('topLeft').top + 'px',
          cursor: 'pointer',
          pointerEvents: 'auto'
        }" @click="handleTextClick(0)">
          <component :is="iconComponents[0]" />
        </div>

        <!-- Bottom-right handles -->
        <div class="canvas" v-for="(btnIndex, i) in [1, 2, 3]" :key="i" :style="{
          left: getTextHandlePosition('bottomRight').left - 32 * i + 'px', // 1rem = 16px
          top: getTextHandlePosition('bottomRight').top + 'px',
          cursor: i === 0 ? 'ew-resize' : 'pointer'
        }" @mousedown="i === 0 ? handleTextMouseDown(1, $event) : null"
          @click="btnIndex !== 1 ? handleTextClick(btnIndex) : null">
          <component :is="textIconComponents[btnIndex]" />
        </div>
      </div>
    </div>
    <div class="sidebar">
      <div class="viewport-frame">
        <ViewPort label="Front" v-model="selectedView" />
        <ViewPort label="Back" v-model="selectedView" />
      </div>
      <input type="button" :value="'Sleeve Design'" />
      <div>
        <span>
          <img :src="Zoom">Zoom In/Out
        </span>
      </div>

      <input type="button" @click="showGrid = !showGrid" :value="showGrid ? 'Hide Grid' : 'Show Grid'" />

    </div>

  </div>
</template>

<script setup lang="ts">
  import { onMounted, watch, ref, reactive, computed } from 'vue';
  import { useClothingStore } from '../../stores/clothingStore';
  import DeleteIcon from 'vue-material-design-icons/Close.vue'
  import DuplicateIcon from 'vue-material-design-icons/ContentDuplicate.vue'
  import ResizeIcon from 'vue-material-design-icons/CropFree.vue'
  import ArrowLeftRight from 'vue-material-design-icons/ArrowLeftRight.vue'
  import RotateIcon from 'vue-material-design-icons/RotateRight.vue'
  import ViewPort from '../../components/shirtlab/Viewports/ViewPort.vue';
  import type { TextObject, ImageObject } from './types'
  // ADD with the other imports
  import { withDefaults, getEffectTransform, getEffectAdvance, applyToContext } from '../sideMenu/types/effectsList';

  const emit = defineEmits<{
    (e: 'selectText', payload: TextObject): void;

  }>();

  const props = defineProps<{
    clothing?: {
      name?: string;
      front?: string;    // URL for front garment image
      back?: string;     // URL for back garment image
      grid?: { x: number; y: number; w: number; h: number };
      colors?: Array<{ background?: string }>; // legacy fallback
    }
  }>();




  import Zoom from './image.png'
  import { rotate } from 'three/tsl';
  // Icon component array for handle buttons
  const iconComponents = [DeleteIcon, ResizeIcon, DuplicateIcon, RotateIcon];
  const textIconComponents = [DeleteIcon, ArrowLeftRight, DuplicateIcon, RotateIcon];

  // --- Text handles logic ---
  let resizingText = false;
  // Drag state for text dragging
  let draggingTextIndex = -1;
  let textDragOffset = { x: 0, y: 0 };


  // at top-level (script setup)
  let onWinMove: ((e: MouseEvent) => void) | null = null;
  let onWinUp: ((e: MouseEvent) => void) | null = null;

  function handleTextMouseDown(index: number, event: MouseEvent) {
    event.preventDefault();
    if (index !== 1) return; // only BR resize
    const t = selectedObject.value as TextObject;
    if (!t) return;

    resizingText = true;
    mouseDown.value = true;

    // global listeners so drag works even though we started on a DOM handle
    onWinMove = (e) => onDrag(e as unknown as MouseEvent);
    onWinUp = () => stopDrag();

    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
  }

  function getTextHandlePosition(pos: 'topLeft' | 'bottomRight') {
    const t = selectedObject.value as TextObject;
    const ctx = canvas.value?.getContext('2d');
    if (!t || !ctx) return { top: 0, left: 0 };

    const block = layoutTextBlock(ctx, t);
    const topLeft = { top: block.boundsTop, left: block.boundsLeft };
    const bottomRight = { top: block.boundsTop + block.height, left: block.boundsLeft + block.width };
    const bottomLeft = { top: block.boundsTop + block.height, left: block.boundsLeft };
    const bottomCenter = { top: block.boundsTop + block.height, left: block.boundsLeft + block.width / 2 };

    if (pos === 'topLeft') return topLeft;
    if (pos === 'bottomRight') {
      // Move the resize handle depending on alignment
      if (t.alignment === 'right') return bottomLeft;    // left side for right alignment
      if (t.alignment === 'center') return bottomCenter; // centered for center alignment
      return bottomRight;                                 // right side for left alignment
    }
    return { top: 0, left: 0 };
  }

  function handleTextClick(index: number) {
    const t = selectedObject.value as TextObject;
    if (!t) return;
    switch (index) {
      case 0: // delete
        texts.splice(texts.findIndex(x => x.isSelected), 1);
        selectedObject.value = null
        break;
      case 2: // duplicate
        deselectAll()
        const clone = { ...t, id: crypto.randomUUID?.() || Date.now().toString() };
        clone.x += 20; clone.y += 20;
        clone.isSelected = true
        texts.push(clone);
        selectedObject.value = clone
        break;
      case 3: // rotate
        t.rotation = (t.rotation + 15) % 360;

        break;
    }
    draw();
  }

  const images = reactive<ImageObject[]>([]);
  const texts = reactive<TextObject[]>([]);

  // unified layering
  let zCounter = 1;
  // Get all objects with their z-order, sorted ascending by z (lowest first, topmost last)
  function getAllObjectsByZ() {
    const all = [...images, ...texts] as Array<any>;
    all.sort((a, b) => ((a.z ?? 0) - (b.z ?? 0))); // lowest -> highest (topmost last)
    return all;
  }

  function rebalanceZ() {
    const all = getAllObjectsByZ();
    all.forEach((o: any, i: number) => (o.z = i + 1));
    zCounter = all.length + 1;
  }

  function getZExtrema() {
    const all = [...images, ...texts] as Array<any>;
    let minZ = Infinity, maxZ = -Infinity;
    for (const o of all) {
      const z = o.z ?? 0;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minZ)) minZ = 0;
    if (!isFinite(maxZ)) maxZ = 0;
    return { minZ, maxZ };
  }

  // --- Rotated rectangle helpers ---
  function getRotationRadians(item: { rotation?: number }) {
    return ((item.rotation || 0) * Math.PI) / 180;
  }

  function getRotatedCorners(item: { x: number; y: number; w: number; h: number; rotation?: number }) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const rad = getRotationRadians(item);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // unrotated corners
    const TL = { x: item.x, y: item.y };
    const TR = { x: item.x + item.w, y: item.y };
    const BL = { x: item.x, y: item.y + item.h };
    const BR = { x: item.x + item.w, y: item.y + item.h };

    function rot(p: { x: number; y: number }) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }
    return { TL: rot(TL), TR: rot(TR), BL: rot(BL), BR: rot(BR) };
  }

  // Helper to compute the axis-aligned bounding box corners of a rotated item
  function getAABBCorners(item: { x: number; y: number; w: number; h: number; rotation?: number }) {
    const c = getRotatedCorners(item);
    const minX = Math.min(c.TL.x, c.TR.x, c.BL.x, c.BR.x);
    const maxX = Math.max(c.TL.x, c.TR.x, c.BL.x, c.BR.x);
    const minY = Math.min(c.TL.y, c.TR.y, c.BL.y, c.BR.y);
    const maxY = Math.max(c.TL.y, c.TR.y, c.BL.y, c.BR.y);
    return {
      TL: { x: minX, y: minY },
      TR: { x: maxX, y: minY },
      BL: { x: minX, y: maxY },
      BR: { x: maxX, y: maxY },
    };
  }

  function pointInRotatedRect(px: number, py: number, item: { x: number; y: number; w: number; h: number; rotation?: number }) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const rad = -getRotationRadians(item); // inverse
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return (lx >= -item.w / 2 && lx <= item.w / 2 && ly >= -item.h / 2 && ly <= item.h / 2);
  }

  // Axis-aligned bounding box (AABB) of the rotated rect
  function getAABB(item: { x: number; y: number; w: number; h: number; rotation?: number }) {
    const c = getRotatedCorners(item);
    const minX = Math.min(c.TL.x, c.TR.x, c.BL.x, c.BR.x);
    const maxX = Math.max(c.TL.x, c.TR.x, c.BL.x, c.BR.x);
    const minY = Math.min(c.TL.y, c.TR.y, c.BL.y, c.BR.y);
    const maxY = Math.max(c.TL.y, c.TR.y, c.BL.y, c.BR.y);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  // Translate item so its rotated AABB stays fully inside the grid
  function clampIntoGrid(item: { x: number; y: number; w: number; h: number; rotation?: number }) {
    const grid = clothingDetails.value.grid;
    const a = getAABB(item);
    let dx = 0, dy = 0;
    if (a.minX < grid.x) dx = grid.x - a.minX;
    if (a.maxX > grid.x + grid.w) dx = Math.min(dx, (grid.x + grid.w) - a.maxX);
    if (a.minY < grid.y) dy = grid.y - a.minY;
    if (a.maxY > grid.y + grid.h) dy = Math.min(dy, (grid.y + grid.h) - a.maxY);
    if (dx !== 0 || dy !== 0) {
      item.x += dx;
      item.y += dy;
    }
  }



  function getHandlePosition(index: number) {
    const img = selectedObject.value as ImageObject;
    if (!img) return { x: 0, y: 0 };
    const a = getAABBCorners(img);
    switch (index) {
      case 0: return { x: a.TL.x, y: a.TL.y }; // TL (delete)
      case 1: return { x: a.TR.x, y: a.TR.y }; // TR (resize)
      case 2: return { x: a.BL.x, y: a.BL.y }; // BL (duplicate)
      case 3: return { x: a.BR.x, y: a.BR.y }; // BR (rotate)
      default: return { x: 0, y: 0 };
    }
  }

  function handleMouseDown(index: number, event: MouseEvent) {
    event.preventDefault();
    if (index === 1) { // Only for resize handle
      console.log('Holding down on resize handle');
      const rect = canvas.value!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      for (let i = images.length - 1; i >= 0; i--) {
        const item = images[i];
        if (!item.isSelected) continue;
        const size = handleStyles.size * 2;
        const a = getAABBCorners(item);
        const handles = [
          [a.TL.x, a.TL.y],
          [a.TR.x, a.TR.y],
          [a.BL.x, a.BL.y],
          [a.BR.x, a.BR.y],
        ];
        const hx = handles[1][0];
        const hy = handles[1][1];
        if (
          x >= hx - size / 2 && x <= hx + size / 2 &&
          y >= hy - size / 2 && y <= hy + size / 2
        ) {
          resizeHandleIndex = 1;
          resizingImageIndex = i;
          mouseDown.value = true;
          return;
        }
      }
    }
  }

  function handleImageClick(index: number) {
    const img = selectedObject.value as ImageObject;
    if (!img || img.type !== 'image') return;

    switch (index) {
      case 0: // delete
        images.splice(images.indexOf(img), 1);
        selectedObject.value = null;
        break;
      case 2: // duplicate
        const imgClone = { ...img, id: crypto.randomUUID?.() || Date.now().toString() };
        imgClone.x += 20;
        imgClone.y += 20;
        images.push(imgClone);
        break;
      case 3: // rotate
        img.rotation = ((img.rotation || 0) + 90) % 360;
        clampIntoGrid(img);
        break;
    }
    draw();
  }

  const handleStyles = {
    size: 14,
    color: '#0af',
    borderRadius: 0, // for future use if needed
    lineHeight: '1rem'
  };

  const clothingStore = useClothingStore();

  // Guide area constants
  const showGrid = ref(true);
  type View = 'Front' | 'Back';
  const selectedView = ref<View>('Front');
  const clothingDetails = ref({
    name: '',
    image: '',
    grid: { x: 175, y: 150, w: 250, h: 400 },
    style: '',
    gender: '',
    size: ''
  });

  function centerSelectedText() {
    console.log("Centering")
    const t = selectedObject.value;
    if (!t || t.type !== 'text') return;

    const ctx = canvas.value?.getContext('2d');
    if (!ctx) return;

    const block = layoutTextBlock(ctx, t);
    const grid = clothingDetails.value.grid;

    t.x = grid.x + (grid.w - block.width) / 2;

    draw();
  }

  function duplicateSelectedText() {
    const t = selectedObject.value as any;
    if (!t || t.type !== 'text') return;
    const clone = {
      ...t,
      id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `t-${Date.now()}`,
      x: t.x + 10,
      y: t.y + 10,
      isSelected: true,
    };
    // deselect originals, select clone
    texts.forEach((x: any) => (x.isSelected = false));
    texts.push(clone);
    selectedObject.value = clone;
    draw();
  }

  function bringSelectedForward() {
    const sel = selectedObject.value as any;
    if (!sel) return;
    const { maxZ } = getZExtrema();
    sel.z = (maxZ || 0) + 1;
    rebalanceZ();
    draw();
  }

  function sendSelectedBack() {
    const sel = selectedObject.value as any;
    if (!sel) return;
    const { minZ } = getZExtrema();
    sel.z = (isFinite(minZ) ? minZ : 1) - 1;
    rebalanceZ();
    draw();
  }
  // Listen for clothing selection events from parent
  // If using v-on="selectClothing" directly, receive as prop instead, or use event bus.
  // Here, we'll assume you receive it as a prop or via a custom event.
  function handleClothingSelect(details: any) {
    console.log(details);
    if (!details) return;

    if (details.grid) clothingDetails.value = details;

    if (details.front || details.back || (details.colors && details.colors[0]?.background)) {
      if (details.front) viewToSrc.Front = details.front;
      if (details.back) {
        viewToSrc.Back = details.back;
      } else if (details.front) {
        viewToSrc.Back = details.front;
      }
      if (!details.front && !details.back && details.colors?.[0]?.background) {
        viewToSrc.Front = details.colors[0].background;
        viewToSrc.Back = details.colors[0].background;
      }
      // SS Activewear swatchId fallback
      if (details.colors?.[0]?.swatchId) {
        const sid = details.colors[0].swatchId;
        viewToSrc.Front = `https://cdn.ssactivewear.com/Images/Color/${sid}_f_fl.jpg`;
        viewToSrc.Back = `https://cdn.ssactivewear.com/Images/Color/${sid}_b_fl.jpg`;
      }
      setShirtBackground(viewToSrc[selectedView.value] || viewToSrc.Front || '/tshirt.png');
    }

    images.splice(0, images.length);
    draw();
  }

  // Option 1: Listen to custom event (e.g. $emit('selectClothing', {...}))
  if (typeof window !== 'undefined') {
    window.addEventListener('shirtlab-selectClothing', (e: any) => {
      handleClothingSelect(e.detail);
    });
  }

  const fileInput = ref<HTMLInputElement | null>(null);

  watch(showGrid, () => {
    draw();
  });

  // Remember the original grid before entering create mode
  let originalGrid = { ...clothingDetails.value.grid };

  watch(() => clothingStore.isCreating, (creating) => {
    if (creating) {
      console.log('Entered create mode');
      originalGrid = { ...clothingDetails.value.grid };
    } else {
      clothingDetails.value.grid = { ...originalGrid };
      draw();
    }
  });


  // Keep Pinia store currentGrid in sync when grid boundary is changed
  watch(() => clothingDetails.value.grid, (newGrid) => {
    if (clothingStore.isCreating) {
      clothingStore.setCurrentGrid({ ...newGrid });
    }
  }, { deep: true });

  let guideX = clothingDetails.value.grid.x;
  let guideY = clothingDetails.value.grid.y;
  let guideW = clothingDetails.value.grid.w;
  let guideH = clothingDetails.value.grid.h;

  const mouseDown = ref(false);

  const canvas = ref<HTMLCanvasElement | null>(null);
  const canvasWidth = 600;
  const canvasHeight = 1000;

  const canvasCursor = ref("default");
  const shirtBgLoaded = ref(false);
  const shirtBgError = ref<string | null>(null);
  const shirtBg = new window.Image();
  shirtBg.crossOrigin = 'anonymous';

  function setShirtBackground(src?: string | null) {
    const next = src || '';
    shirtBgLoaded.value = false;
    shirtBgError.value = null;
    if (!next) {
      shirtBg.src = '';
      draw();
      return;
    }
    shirtBg.onload = () => {
      shirtBgLoaded.value = true;
      shirtBgError.value = null;
      draw();
    };
    shirtBg.onerror = () => {
      shirtBgLoaded.value = false;
      shirtBgError.value = `Failed to load shirt image: ${next}`;
      draw();
    };
    shirtBg.src = next;
  }

  // ---- Garment background transform (for fine alignment) ----
  const bgTransform = reactive({ offsetX: 0, offsetY: 0, scale: 1 });
  function setBackgroundTransform(t: { offsetX?: number; offsetY?: number; scale?: number }) {
    if (typeof t.offsetX === 'number') bgTransform.offsetX = t.offsetX;
    if (typeof t.offsetY === 'number') bgTransform.offsetY = t.offsetY;
    if (typeof t.scale === 'number') bgTransform.scale = t.scale;
    draw();
  }

  onMounted(() => {
    setShirtBackground(viewToSrc[selectedView.value] || viewToSrc.Front || '/tshirt.png');
  });
  const viewToSrc = reactive<Record<View, string>>({
    Front: props.clothing?.front || props.clothing?.colors?.[0]?.background || '',
    Back: props.clothing?.back || props.clothing?.front || props.clothing?.colors?.[0]?.background || '',
  });
  watch(selectedView, (newVal: View) => {
    setShirtBackground(viewToSrc[newVal] || viewToSrc.Front || '');
  });
  watch(() => props.clothing, (c) => {
    if (!c) return;

    if (c.grid) clothingDetails.value.grid = { ...c.grid };

    if (c.front) viewToSrc.Front = c.front;
    if (c.back) {
      viewToSrc.Back = c.back;
    } else if (c.front) {
      viewToSrc.Back = c.front;
    }

    if (!c.front && !c.back && c.colors?.[0]?.background) {
      viewToSrc.Front = c.colors[0].background;
      viewToSrc.Back = c.colors[0].background;
    }

    setShirtBackground(viewToSrc[selectedView.value] || viewToSrc.Front || '/tshirt.png');

    images.splice(0, images.length);
    draw();
  }, { immediate: true, deep: true });

  // Each placed image object: { img, x, y, w, h, aspect, origW, origH, isSelected }
  let dragOffset = { x: 0, y: 0 };
  let draggingIndex = -1;

  let resizeHandleIndex = -1;
  let resizingImageIndex = -1;
  let resizeGuideHandle = -1;

  // For dragging the guide boundary's center in create mode
  let draggingGuide = false;
  let guideDragOffset = { x: 0, y: 0 };

  type PlacedObject = ImageObject | TextObject;

  const selectedObject = ref<PlacedObject | null>(null);

  function deleteSelectedImage() {
    const idx = images.findIndex((img) => img.isSelected);
    if (idx !== -1) {
      images.splice(idx, 1);
      draw();
    }
  }

  function onFileChange(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        // Use uploadObject for image
        uploadObject('image', { imgUrl: ev.target?.result });
      };
      reader.readAsDataURL(file);
    }
  }

  function drawShirtBg(ctx: CanvasRenderingContext2D) {
    if (shirtBgLoaded.value) {
      // Draw the shirt background using contain-fit, then apply tweakable transform
      const iw = (shirtBg as any).naturalWidth || shirtBg.width || 1;
      const ih = (shirtBg as any).naturalHeight || shirtBg.height || 1;

      const baseScale = Math.min(canvasWidth / iw, canvasHeight / ih);
      const w = iw * baseScale * (bgTransform.scale || 1);
      const h = ih * baseScale * (bgTransform.scale || 1);

      const x = (canvasWidth - w) / 2 + (bgTransform.offsetX || 0);
      const y = (canvasHeight - h) / 2 + (bgTransform.offsetY || 0) - 150;

      ctx.drawImage(shirtBg, x, y, w, h);
    } else {

      if (shirtBgError.value) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Image unavailable', canvasWidth / 2, canvasHeight / 2);
      }
    }
  }

  // --- Text wrapping + measurement helper ---
  // --- Text wrapping + measurement helper (now wraps long words) ---
  // --- Text wrapping + measurement helper (no double-push, breaks long words) ---
  // Glyph-tight layout that accounts for overshoots (H, J, swashes, etc.)
  // Glyph-tight layout + word wrap + alignment
  // Word-only wrap (no letter-by-letter splits, no hyphens)
  function layoutTextBlock(ctx: CanvasRenderingContext2D, t: TextObject) {
    const basePx = INCH_PX;
    const pxSize = t.size * basePx; // your 4x canvas scale
    ctx.font = `${pxSize}px ${t.font}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = t.alignment;

    // metrics
    const probe = ctx.measureText('Mg');
    const ascent = probe.actualBoundingBoxAscent || pxSize * 0.75;
    const descent = probe.actualBoundingBoxDescent || pxSize * 0.25;
    const lineHeight = (ascent + descent) * 1.2;

    // fixed textbox width, capped by grid (keeps box stable)
    const grid = clothingDetails.value.grid;
    const rawW = Number.isFinite(t.w as any) ? Number(t.w) : grid.w;
    const boxWidth = Math.max(20, Math.min(rawW, grid.w));
    const maxWidth = boxWidth;

    // wrap one paragraph by words only
    function wrapParagraph(text: string): string[] {
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length) return [''];

      const out: string[] = [];
      let line = '';

      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          if (line) out.push(line);
          // word alone too wide? keep it whole on its own line (no mid-word break)
          line = w;
        }
      }
      if (line) out.push(line);
      return out;
    }

    // support explicit newlines
    const paragraphs = String(t.content ?? '').split(/\r?\n/);
    const lines: string[] = [];
    for (let p = 0; p < paragraphs.length; p++) {
      const wrapped = wrapParagraph(paragraphs[p]);
      lines.push(...wrapped);
      // (optional) preserve blank line between paragraphs: lines.push('');
    }
    if (!lines.length) lines.push('');

    // per-line widths + aligned start X (text sits inside the fixed box)
    const lineWidths = lines.map(ln => ctx.measureText(ln).width);
    // anchor X used for drawing (respect alignment) but keep within the fixed box [t.x .. t.x + maxWidth]
    const anchorX = (
      t.alignment === 'center' ? t.x + maxWidth / 2 :
        t.alignment === 'right' ? t.x + maxWidth :
          t.x
    );
    const lineX = lineWidths.map(() => anchorX);

    // alignment-aware bounds over all lines based on visual placement
    let minLeft = Infinity, maxRight = -Infinity;

    for (let li = 0; li < lines.length; li++) {
      const w = lineWidths[li];
      const anchor = lineX[li];
      const left = (t.alignment === 'center') ? anchor - w / 2
        : (t.alignment === 'right') ? anchor - w
          : anchor; // left
      const right = left + w;
      if (left < minLeft) minLeft = left;
      if (right > maxRight) maxRight = right;
    }

    // vertical extent from first baseline to last, plus ascent/descent
    const minTop = t.y - ascent;
    const maxBottom = t.y + (lines.length - 1) * lineHeight + descent;

    // fallback for empty content
    if (!isFinite(minLeft)) {
      minLeft = t.x;
      maxRight = t.x;
    }

    const pad = (t.outlineWidth || 0) * 0.5 + 1;
    const boundsLeft = minLeft - pad;
    const boundsTop = minTop - pad;
    const boundsRight = maxRight + pad;
    const boundsBottom = maxBottom + pad;

    return {
      lines,
      lineWidths,
      lineX,
      pxSize,
      lineHeight,
      ascent,
      descent,
      boundsLeft,
      boundsTop,
      boundsRight,
      boundsBottom,
      width: boundsRight - boundsLeft,
      height: boundsBottom - boundsTop,
    };
  }

  // --- Ruler constants ---
  const INCH_PX = 40; // adjust as needed

  // Draw rulers (call after grid lines, before objects)
  function drawRulers(ctx: CanvasRenderingContext2D, gridX: number, gridY: number, gridWidth: number, gridHeight: number) {
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 1;

    // Top ruler
    for (let x = 0; x <= gridWidth; x += INCH_PX / 4) {
      const px = gridX + x;
      ctx.beginPath();
      let tickHeight = (x % INCH_PX === 0) ? 10 : (x % (INCH_PX / 2) === 0 ? 7 : 4);
      ctx.moveTo(px, gridY);
      ctx.lineTo(px, gridY - tickHeight);
      ctx.stroke();
      if (x % INCH_PX === 0 && x !== 0) {
        ctx.fillText((x / INCH_PX).toString(), px, gridY - 25);
      }
    }

    // Left ruler
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = 0; y <= gridHeight; y += INCH_PX / 4) {
      const py = gridY + y;
      ctx.beginPath();
      let tickWidth = (y % INCH_PX === 0) ? 10 : (y % (INCH_PX / 2) === 0 ? 7 : 4);
      ctx.moveTo(gridX, py);
      ctx.lineTo(gridX - tickWidth, py);
      ctx.stroke();
      if (y % INCH_PX === 0 && y !== 0) {
        ctx.fillText((y / INCH_PX).toString(), gridX - 15, py);
      }
    }
    ctx.restore();
  }

  function draw() {
    const ctx = canvas.value?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawShirtBg(ctx);

    if (showGrid.value) {
      // Draw grid
      ctx.save();
      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 1;
      const gridStep = 40;
      for (let x = clothingDetails.value.grid.x; x <= clothingDetails.value.grid.x + clothingDetails.value.grid.w; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, clothingDetails.value.grid.y);
        ctx.lineTo(x, clothingDetails.value.grid.y + clothingDetails.value.grid.h);
        ctx.stroke();
      }
      for (let y = clothingDetails.value.grid.y; y <= clothingDetails.value.grid.y + clothingDetails.value.grid.h; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(clothingDetails.value.grid.x, y);
        ctx.lineTo(clothingDetails.value.grid.x + clothingDetails.value.grid.w, y);
        ctx.stroke();
      }
      // Draw guide border
      ctx.strokeStyle = "#4af";
      ctx.lineWidth = 2;
      ctx.strokeRect(clothingDetails.value.grid.x, clothingDetails.value.grid.y, clothingDetails.value.grid.w, clothingDetails.value.grid.h);

      // Draw boundary resize handles if creating
      if (clothingStore.isCreating) {
        const size = handleStyles.size;

        const handles = [
          [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y], // TR
          // Sides
          [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y], // Top
          [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // Bottom
          [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Left
          [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Right
        ];
        ctx.fillStyle = handleStyles.color;
        handles.forEach(([x, y]) => ctx.fillRect(x - size / 2, y - size / 2, size, size));
      }

      ctx.restore();

      // --- Draw rulers after grid, before objects ---
      drawRulers(
        ctx,
        clothingDetails.value.grid.x,
        clothingDetails.value.grid.y,
        clothingDetails.value.grid.w,
        clothingDetails.value.grid.h
      );
    }

    // --- Unified z-ordered rendering of images and text ---
    const ordered = getAllObjectsByZ() as Array<any>;
    for (const obj of ordered) {
      if (obj.type === 'image') {
        const item = obj as any;

        ctx.globalAlpha = 1;

        ctx.save();
        const cx = item.x + item.w / 2;
        const cy = item.y + item.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        // draw the image centered in its frame; frame size stays constant
        ctx.drawImage(item.img, -item.w / 2, -item.h / 2, item.w, item.h);
        ctx.restore();

        if (item.isSelected) {
          const { TL, TR, BR, BL } = getRotatedCorners(item);
          ctx.save();
          ctx.strokeStyle = '#0af';
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
          ctx.beginPath();
          ctx.moveTo(TL.x, TL.y);
          ctx.lineTo(TR.x, TR.y);
          ctx.lineTo(BR.x, BR.y);
          ctx.lineTo(BL.x, BL.y);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.restore();
        }
      } else if (obj.type === 'text') {
        const t = obj as any;
        // layout
        const block = layoutTextBlock(ctx, t);


        // styles
        const eff = t.effect && t.effect.name ? t.effect : { name: 'none', options: withDefaults('none') };
        const effName = eff.name;
        const effOpts = withDefaults(eff.name, eff.options); // ensure all knobs present


        ctx.font = `${block.pxSize}px ${t.font}`;
        ctx.fillStyle = t.color;
        ctx.strokeStyle = t.outlineColor;
        ctx.lineWidth = t.outlineWidth;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = t.alignment;

        let y = t.y;

        for (let li = 0; li < block.lines.length; li++) {
          const ln = block.lines[li];
          const anchor = block.lineX[li]; // your existing anchor (left/center/right)

          const chars = Array.from(ln);
          if (!chars.length) { y += block.lineHeight; continue; }

          // measure base advances once
          const advances = chars.map(ch => ctx.measureText(ch).width);
          const baseWidth = advances.reduce((a, b) => a + b, 0);

          // compute per-glyph extra spacing from the effect
          const extras = chars.map((_, i) => getEffectAdvance(effName));
          const extraSum = extras.reduce((a, b) => a + b, 0);
          const effWidth = baseWidth + extraSum;

          // convert your anchor to a leftX that preserves position
          // - left: anchor is left edge
          // - center: keep center fixed -> shift left by effWidth/2
          // - right: keep right edge fixed -> shift left by effWidth
          let leftX = anchor;
          if (t.alignment === 'center') leftX = anchor - effWidth / 2;
          else if (t.alignment === 'right') leftX = anchor - effWidth;

          // per-glyph draw at fixed baseline y, starting from leftX
          let cursorX = leftX;
          for (let i = 0; i < chars.length; i++) {
            // inside the glyph loop
            const ch = chars[i];
            const tr = getEffectTransform(effName, i, chars.length, effOpts);

            // pivot: top of the glyph for 'spreadOut'; baseline for others
            let originY = 0;
            if (effName === 'spreadOut') {
              const m = ctx.measureText(ch);
              const ascent = m.actualBoundingBoxAscent ?? block.pxSize * 0.8; // fallback if metric missing
              originY = -ascent; // pivot at top so scaleY grows downward
            }

            ctx.save();
            applyToContext(ctx, cursorX, y, tr, 0, originY); // originX=0 is fine
            ctx.fillText(ch, 0, 0);
            if (t.outlineColor && t.outlineColor !== 'None' && t.outlineWidth > 0) {
              ctx.strokeText(ch, 0, 0);
            }
            ctx.restore();

            cursorX += advances[i] /* + extras[i] if you had any */;
          }

          y += block.lineHeight;
        }


        if (t.isSelected) {
          ctx.save();
          ctx.strokeStyle = '#0af';
          ctx.lineWidth = 1.5;
          ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
          ctx.strokeRect(block.boundsLeft, block.boundsTop, block.width, block.height);
          ctx.fillRect(block.boundsLeft, block.boundsTop, block.width, block.height);
          // Do not set selectedObject.value here!
          ctx.restore();
        }
      }
    }
  }



  onMounted(draw);

  function findObjectAt(x: number, y: number): { type: 'image' | 'text'; index: number } | null {
    const ctx = canvas.value?.getContext('2d');
    const ordered = getAllObjectsByZ() as Array<any>;
    // Walk from topmost to backmost
    for (let i = ordered.length - 1; i >= 0; i--) {
      const obj = ordered[i];
      if (obj.type === 'text') {
        if (!ctx) continue;
        const block = layoutTextBlock(ctx, obj);
        const bx = block.boundsLeft;
        const by = block.boundsTop;
        if (x >= bx && x <= bx + block.width && y >= by && y <= by + block.height) {
          const tIndex = texts.findIndex(t => t.id === obj.id);
          if (tIndex !== -1) return { type: 'text', index: tIndex };
        }
      } else if (obj.type === 'image') {
        if (pointInRotatedRect(x, y, obj)) {
          const iIndex = images.findIndex(im => im.id === obj.id);
          if (iIndex !== -1) return { type: 'image', index: iIndex };
        }
      }
    }
    return null;
  }


  function onHover(e: MouseEvent) {
    console.log("Hovering")
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check guide handles if creating
    if (clothingStore.isCreating) {
      const size = 20;
      const guideHandles = [
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y], // TR
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y], // Top
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // Bottom
        [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Left
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Right
      ];

      if (
        x >= clothingDetails.value.grid.x &&
        x <= clothingDetails.value.grid.x + clothingDetails.value.grid.w &&
        y >= clothingDetails.value.grid.y &&
        y <= clothingDetails.value.grid.y + clothingDetails.value.grid.h
      ) {
        canvasCursor.value = 'move';
        return;
      }
    }

    // --- Only show handle cursors for the SELECTED object ---
    const sel = selectedObject.value;

    if (sel && sel.type === 'image' && (sel as any).showHandles) {
      const item = sel as ImageObject;
      const size = handleStyles.size; // smaller hit area, matches startDrag
      const a = getAABBCorners(item);
      const handles: [number, number][] = [
        [a.TL.x, a.TL.y],
        [a.TR.x, a.TR.y],
        [a.BL.x, a.BL.y],
        [a.BR.x, a.BR.y],
      ];
      for (let h = 0; h < handles.length; h++) {
        const [hx, hy] = handles[h];
        if (x >= hx - size / 2 && x <= hx + size / 2 &&
          y >= hy - size / 2 && y <= hy + size / 2) {
          // Only TR should show resize cursor
          if (h === 1) canvasCursor.value = 'nesw-resize';
          else canvasCursor.value = 'pointer';
          return;
        }
      }
    }

    if (sel && sel.type === 'text' && (sel as any).showHandles) {
      const t = sel as TextObject;
      // bottom-right handle for text (resize), matching your render positions
      const br = getTextHandlePosition('bottomRight');
      const size = handleStyles.size;
      if (x >= br.left - size / 2 && x <= br.left + size / 2 &&
        y >= br.top - size / 2 && y <= br.top + size / 2) {
        canvasCursor.value = 'ew-resize';
        return;
      }
    }

    // Check if over any image or text
    const found = findObjectAt(x, y);
    hoveredObject.value = found;
    if (found) {
      canvasCursor.value = 'move';
      return;
    }

    // Default
    canvasCursor.value = 'default';
  }

  const hoveredObject = ref<{ type: 'image' | 'text'; index: number } | null>(null);

  function onMove(e: MouseEvent) {
    if (mouseDown.value) {
      onDrag(e);
    } else {
      onHover(e);
    }
  }

  // Drag logic
  function startDrag(e: MouseEvent) {
    e.preventDefault();
    mouseDown.value = true;
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for guide boundary handles if in create mode
    if (clothingStore.isCreating) {
      const size = 20;
      const guideHandles = [
        // Corners
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y], // TR
        // Sides
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y], // Top
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // Bottom
        [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Left
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Right
      ];
      for (let h = 0; h < guideHandles.length; h++) {
        const [hx, hy] = guideHandles[h];
        if (
          x >= hx - size / 2 &&
          x <= hx + size / 2 &&
          y >= hy - size / 2 &&
          y <= hy + size / 2
        ) {
          resizeGuideHandle = h;
          return;
        }
      }
      // If no handle matched, check if inside guide box for dragging
      if (
        x >= clothingDetails.value.grid.x &&
        x <= clothingDetails.value.grid.x + clothingDetails.value.grid.w &&
        y >= clothingDetails.value.grid.y &&
        y <= clothingDetails.value.grid.y + clothingDetails.value.grid.h
      ) {
        draggingGuide = true;
        guideDragOffset.x = x - clothingDetails.value.grid.x;
        guideDragOffset.y = y - clothingDetails.value.grid.y;
        return;
      }
    }

    // Try handles FIRST, starting with topmost images
    for (let i = images.length - 1; i >= 0; i--) {
      const item = images[i];
      if (!item.isSelected) continue;            // <-- key line

      const size = handleStyles.size;            // smaller hit area
      const handles = [
        [item.x, item.y],                         // TL
        [item.x + item.w, item.y],                // TR
        [item.x, item.y + item.h],                // BL
        [item.x + item.w, item.y + item.h],       // BR
      ];
      for (let h = 0; h < handles.length; h++) {
        const [hx, hy] = handles[h];
        if (
          x >= hx - size / 2 && x <= hx + size / 2 &&
          y >= hy - size / 2 && y <= hy + size / 2
        ) {
          images.forEach((img, idx) => (img.isSelected = idx === i));
          draw();
          switch (h) {
            case 0: // TL - delete
              // Do nothing here. Triggered on click only.
              return;
            case 1: // TR - resize
              resizeHandleIndex = 1;
              resizingImageIndex = i;
              draggingIndex = -1;
              return;
            case 2: // BL - duplicate
            case 3: // BR - rotate
              // Do nothing here. Triggered on click only.
              return;
          }
        }
      }
    }

    // --- Updated selection logic ---
    // Hit-test any object (z-ordered; topmost first)
    const found = findObjectAt(x, y);
    // Select images
    const imgIdx = found?.type === 'image' ? found.index : -1;
    images.forEach((img, i) => img.isSelected = false);
    texts.forEach(t => t.isSelected = false);

    if (found) {
      if (found.type === 'image') {
        const img = images[found.index];
        img.isSelected = true;
        selectedObject.value = img;
      } else if (found.type === 'text') {
        const t = texts[found.index];
        t.isSelected = true;
        selectedObject.value = t;

        // Enable dragging for text
        draggingTextIndex = found.index;
        textDragOffset.x = x - t.x;
        textDragOffset.y = y - t.y;
      }
    } else {
      selectedObject.value = null;
    }


    // Image clicked: start image drag
    draggingIndex = imgIdx;

    if (imgIdx !== -1) {
      dragOffset.x = x - images[imgIdx].x;
      dragOffset.y = y - images[imgIdx].y;
    } else {
      dragOffset.x = 0;
      dragOffset.y = 0;
    }
    draw();
  }

  function onDrag(e: MouseEvent) {
    // Hide handles while dragging text
    if (selectedObject.value?.type === 'text' && draggingTextIndex !== -1) {
      // Temporarily hide handles while dragging
      selectedObject.value.showHandles = false;
    }

    // Text box resize (width-only; rewrap handles height)
    if (resizingText && selectedObject.value?.type === 'text') {
      const t = selectedObject.value as TextObject;
      const rect = canvas.value!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      const grid = clothingDetails.value.grid;
      const minW = 20;

      // Helper clamp
      const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(val, hi));

      if (t.alignment === 'left') {
        // Anchor left, drag from the right
        const left = t.x;
        const maxW = (grid.x + grid.w) - left; // keep right edge <= grid right
        let targetW = mouseX - left;
        targetW = clamp(targetW, minW, maxW);
        t.w = targetW;
        draw();
        return;
      }

      if (t.alignment === 'right') {
        // Anchor right, move left handle; keep left edge >= grid.x
        const right = t.x + (t.w || 0);
        const maxW = right - grid.x; // so left >= grid.x
        let targetW = right - mouseX; // drag leftwards to grow
        targetW = clamp(targetW, minW, maxW);
        t.w = targetW;
        t.x = right - t.w; // recompute left so right stays fixed
        draw();
        return;
      }

      // center alignment
      {
        // Anchor center; expand/contract both sides symmetrically
        const center = t.x + (t.w || 0) / 2;
        let half = Math.abs(mouseX - center);
        // Constrain so both sides stay within grid
        const maxHalfLeft = center - grid.x;
        const maxHalfRight = (grid.x + grid.w) - center;
        const maxHalf = Math.max(minW / 2, Math.min(maxHalfLeft, maxHalfRight));
        half = clamp(half, minW / 2, maxHalf);
        const targetW = half * 2;
        t.x = center - targetW / 2;
        t.w = targetW;
        draw();
        return;
      }
    }
    console.log("Dragging ", e)
    e.preventDefault();
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // If dragging a text box, move it
    if (draggingTextIndex !== -1) {
      const t = texts[draggingTextIndex];
      // Move text based on drag offset
      t.x = x - textDragOffset.x;
      t.y = y - textDragOffset.y;

      // Measure text size
      const ctx2 = canvas.value?.getContext('2d');
      if (ctx2) {
        const block = layoutTextBlock(ctx2, t);
        const grid = clothingDetails.value.grid;

        const minX = grid.x - (block.boundsLeft - t.x); // how far left we can move baseline before left bound hits grid
        const maxX = grid.x + grid.w - (block.boundsRight - t.x);
        const minY = grid.y - (block.boundsTop - t.y);
        const maxY = grid.y + grid.h - (block.boundsBottom - t.y);

        t.x = Math.max(minX, Math.min(t.x, maxX));
        t.y = Math.max(minY, Math.min(t.y, maxY));
      }
      draw();
      return;
    }
    // Guide boundary resizing logic
    if (resizeGuideHandle !== -1) {
      const xPos = x;
      const yPos = y;

      switch (resizeGuideHandle) {

        case 0: // TR
          clothingDetails.value.grid.w = xPos - clothingDetails.value.grid.x;
          clothingDetails.value.grid.h += clothingDetails.value.grid.y - yPos;
          clothingDetails.value.grid.y = yPos;
          break;

        case 4: // Top
          clothingDetails.value.grid.h += clothingDetails.value.grid.y - yPos;
          clothingDetails.value.grid.y = yPos;
          break;
        case 5: // Bottom
          clothingDetails.value.grid.h = yPos - clothingDetails.value.grid.y;
          break;
        case 6: // Left
          clothingDetails.value.grid.w += clothingDetails.value.grid.x - xPos;
          clothingDetails.value.grid.x = xPos;
          break;
        case 7: // Right
          clothingDetails.value.grid.w = xPos - clothingDetails.value.grid.x;
          break;
      }

      // Minimum size
      clothingDetails.value.grid.w = Math.max(50, clothingDetails.value.grid.w);
      clothingDetails.value.grid.h = Math.max(50, clothingDetails.value.grid.h);

      draw();
      return;
    }

    // Drag guide boundary by center if in create mode
    if (draggingGuide) {
      const xPos = x;
      const yPos = y;
      clothingDetails.value.grid.x = xPos - guideDragOffset.x;
      clothingDetails.value.grid.y = yPos - guideDragOffset.y;
      draw();
      return;
    }

    // Only allow resizing from TR handle (index 1)
    if (resizeHandleIndex === 1 && resizingImageIndex !== -1) {
      const item = images[resizingImageIndex];
      // Keep frame aspect constant regardless of rotation
      const effAspect = item.aspect;
      // Anchor at bottom-left
      const [anchorX, anchorY] = [item.x, item.y + item.h];
      // Calculate new width and maintain aspect ratio
      let newW = x - anchorX;
      newW = Math.max(20, newW); // minimum width
      let newH = newW / effAspect;
      // Clamp to grid bounds
      const grid = clothingDetails.value.grid;
      const maxW = grid.x + grid.w - anchorX;
      const maxH = anchorY - grid.y;
      if (newW > maxW) {
        newW = maxW;
        newH = newW / effAspect;
      }
      if (newH > maxH) {
        newH = maxH;
        newW = newH * effAspect;
      }
      item.w = newW;
      item.h = newH;
      // Keep bottom-left anchor fixed
      item.y = anchorY - item.h;
      item.isSelected = true;
      // Ensure rotated AABB stays within grid after resize
      clampIntoGrid(item);
      draw();
      return;
    }
    if (draggingIndex === -1) return;
    const item = images[draggingIndex];
    item.x = x - dragOffset.x;
    item.y = y - dragOffset.y;

    // Constrain position using rotated AABB so it stays inside grid
    clampIntoGrid(item);

    draw();
  }

  function stopDrag() {
    if (onWinMove) window.removeEventListener('mousemove', onWinMove);
    if (onWinUp) window.removeEventListener('mouseup', onWinUp);
    onWinMove = null;
    onWinUp = null;

    // Show handles again after drag stops (for text)
    if (selectedObject.value?.type === 'text') {
      (selectedObject.value as any).__minLock = false; // reset min-width lock
      selectedObject.value.showHandles = true;
    }
    mouseDown.value = false;
    draggingIndex = -1;
    resizeHandleIndex = -1;
    resizingImageIndex = -1;
    resizeGuideHandle = -1;
    draggingGuide = false;
    resizingText = false;
    draggingTextIndex = -1;
  }

  function deselectAll() {
    images.forEach(i => (i.isSelected = false));
    texts.forEach(t => (t.isSelected = false));
    selectedObject.value = null;
  }

  function openFileDialog() {
    fileInput.value?.click();
  }

  // Unified object upload (image/text) with correct type signatures
  function uploadObject(
    type: 'image',
    payload: { imgUrl: string }
  ): void;
  function uploadObject(
    type: 'text',
    payload: {
      content?: string;
      font?: string[];
      color?: string;
      outlineColor?: string;
      outlineWidth?: number;
      size?: number;
      alignment?: 'left' | 'center' | 'right';
      rotation?: number;
    }
  ): void;
  function uploadObject(type: 'image' | 'text', payload: any) {
    console.log(type, payload)
    if (type === 'image') {
      const img = new Image();
      img.src = payload.imgUrl;

      img.onload = () => {
        deselectAll()
        images.forEach(i => i.isSelected = false);

        const w = Math.min(img.width / 3, clothingDetails.value.grid.w);
        const h = Math.min(img.height / 3, clothingDetails.value.grid.h);

        images.push({
          id: crypto.randomUUID?.() || Date.now().toString(),
          type: 'image',
          imgUrl: payload.imgUrl,
          img,
          showHandles: true,
          x: clothingDetails.value.grid.x + (clothingDetails.value.grid.w - w) / 2,
          y: clothingDetails.value.grid.y + (clothingDetails.value.grid.h - h) / 2,
          w,
          h,
          aspect: img.width / img.height,
          origW: img.width / 3,
          origH: img.height / 3,
          isSelected: true,
          z: zCounter++,
          rotation: 0,
        });

        draw();
      };
    }

    if (type === 'text') {
      texts.forEach(t => t.isSelected = false);

      texts.push({
        id: crypto.randomUUID?.() || Date.now().toString(),
        type: 'text',
        content: typeof payload === 'string' ? payload : payload.value || 'Sample Text',
        font: payload.font || 'Arial',
        color: payload.color || '#000000',
        outlineColor: payload.outlineColor || 'None',
        outlineWidth: payload.outlineWidth || 2,
        showHandles: true,
        size: payload.size || 1,
        alignment: payload.alignment || 'left',
        rotation: payload.rotation || 0,
        x: clothingDetails.value.grid.x + 30,
        y: clothingDetails.value.grid.y + 100,
        w: clothingDetails.value.grid.w - 40,
        h: 60,
        isSelected: true,
        z: zCounter++,
        // 👇 NEW
        effect: { name: 'none', options: withDefaults('none') },
      });

      draw();
    }
  }

  // TODO: Add watcher or reactive logic to update selected text object when text tab values change

  function updateClothing(details: any) {
    if (!details) return;

    // Update grid if present
    if (details.grid) {
      clothingDetails.value = details;
    }

    // Prefer explicit front/back; fallback to colors[0].background
    const bg = details.colors?.[0]?.background;
    if (details.front || details.back || bg) {
      if (details.front) viewToSrc.Front = details.front;
      if (details.back) viewToSrc.Back = details.back;
      if (!details.front && !details.back && bg) {
        viewToSrc.Front = bg;
        viewToSrc.Back = bg;
      }
      // SS Activewear swatchId fallback
      if (details.colors?.[0]?.swatchId) {
        const sid = details.colors[0].swatchId;
        viewToSrc.Front = `https://cdn.ssactivewear.com/Images/Color/${sid}_f_fl.jpg`;
        viewToSrc.Back = `https://cdn.ssactivewear.com/Images/Color/${sid}_b_fl.jpg`;
      }
      setShirtBackground(viewToSrc[selectedView.value] || '/tshirt.png');
      if (details.bgTransform) {
        setBackgroundTransform(details.bgTransform);
      }
    }

    images.splice(0, images.length);
    draw();
  }



  watch(
    selectedObject,
    (newVal) => {
      if (!newVal) return;

      // Find the real text object in our texts array
      const t = texts.find(txt => txt.id === newVal.id);
      if (t) {
        Object.assign(t, newVal); // sync any changed fields
        draw();
      }
    },
    { deep: true }
  );
  function setClothingImages(imgs: { front?: string; back?: string }) {
    if (imgs.front) viewToSrc.Front = imgs.front;
    if (imgs.back) {
      viewToSrc.Back = imgs.back;
    } else if (imgs.front) {
      viewToSrc.Back = imgs.front;
    }
    setShirtBackground(viewToSrc[selectedView.value] || viewToSrc.Front || '/tshirt.png');
    draw();
  }

  defineExpose({
    openFileDialog,
    updateClothing,
    setClothingImages,
    setBackgroundTransform,
    uploadObject,
    selectedObject,
    draw,
    centerSelectedText,
    duplicateSelectedText,
    bringSelectedForward,
    sendSelectedBack,
  });


</script>

<style scoped lang="scss">

  .page {
    display: flex;
  }

  .lab-container {
    left: 40%;
  }

  * {
    user-select: none;
  }

  .canvas {
    position: absolute;
    z-index: 0;
    background: #fff;
    border-radius: 2rem;
    padding: 6px;
    width: 1rem;
    height: 1rem;
    line-height: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: translate(-50%, -50%);
  }

  .sidebar {
    position: fixed;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.6rem;
    width: auto;
    height: auto;

    span {
      background-color: rgb(255, 255, 255);
      padding: 0.3rem;
      font-family: 'Anek Latin';
      font-size: 0.7rem;
      font-weight: 300;
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      text-align: center;
      justify-content: center;
      margin: 0 auto;

    }

    img {
      object-fit: contain;
      width: 2rem;
      margin: 0 auto;
      padding-right: 5px;
    }

    input {
      cursor: pointer;
      object-fit: contain;
      background: linear-gradient(180deg, #ffffff, #f6f8fb);
      padding: 0.3rem 0.5rem;
      font-family: 'Anek Latin';
      font-size: 0.7rem;
      font-weight: 300;
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      text-align: center;
      justify-content: center;
      margin: 0 auto;
      color: black;
      width: 100%;
      height: 100%;
      border: none;
      position: relative;
      /* for ripple */
      overflow: hidden;
      /* clip ripple */
      will-change: transform, box-shadow, background;
      transform-origin: center;
      transition: transform 140ms ease, box-shadow 200ms ease, background 220ms ease;
      box-shadow: 0 0 0 rgba(0, 0, 0, 0);

      /* subtle hover lift */
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        background: linear-gradient(180deg, #ffffff, #eef2f7);
      }

      /* press state with ripple */
      &:active {
        transform: translateY(0) scale(0.98);
      }

      /* center ripple */
      &::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(167, 197, 102, 0.35);
        /* matches green accent */
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
        pointer-events: none;
      }

      &:active::after {
        animation: ripple 420ms ease-out;
      }
    }

  }


  @keyframes ripple {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0.35;
    }

    60% {
      transform: translate(-50%, -50%) scale(14);
      opacity: 0.18;
    }

    100% {
      transform: translate(-50%, -50%) scale(18);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar input {
      transition: none;
    }

    .sidebar input:active {
      transform: none;
    }

    .sidebar input::after {
      animation: none !important;
    }
  }

  .viewport-frame {
    background-color: rgb(255, 255, 255);
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.6rem;
  }

  /* Target any SVG inside a handle button */
  .canvas :deep(svg) {
    fill: rgb(167, 197, 102);
    /* green */
    stroke: rgb(167, 197, 102);
  }


</style>
