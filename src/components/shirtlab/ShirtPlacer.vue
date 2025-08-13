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

  const emit = defineEmits<{
    (e: 'selectText', payload: TextObject): void;

  }>();



  import Zoom from './image.png'
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



  function getHandlePosition(index: number) {
    const img = selectedObject.value as ImageObject;
    if (!img) return { x: 0, y: 0 };
    switch (index) {
      case 0: return { x: img.x, y: img.y }; // TL
      case 1: return { x: img.x + img.w, y: img.y }; // TR
      case 2: return { x: img.x, y: img.y + img.h }; // BL
      case 3: return { x: img.x + img.w, y: img.y + img.h }; // BR
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
        const hx = item.x + item.w;
        const hy = item.y;
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
        const temp = img.w;
        img.w = img.h;
        img.h = temp;
        img.aspect = img.w / img.h;
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
    console.log(details)
    if (!details || !details.grid) return;
    clothingDetails.value = details;
    // Update shirt background using first color's background if available
    if (details.colors && details.colors[0].background) {
      shirtBg.src = details.colors[0].background;

    }
    // Update grid limits
    // Clear images to avoid misalignment
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

  watch(() => clothingStore.newClothingItem, (item) => {
    if (item && clothingStore.isCreating && item.image) {
      shirtBg.onload = () => {
        shirtBgLoaded.value = true;
        draw();
      };
      shirtBg.src = URL.createObjectURL(item.image);
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

  const shirtBg = new window.Image();
  onMounted(() => {
    shirtBg.src = viewToSrc[selectedView.value]; // set initial image
  });
  const viewToSrc: Record<View, string> = {
    Front: '/tshirt.png',
    Back: '/tshirt.png',
  };
  watch(selectedView, (newVal: View) => {
    shirtBg.src = viewToSrc[newVal] || '/tshirt.png';
    shirtBg.onload = () => {
      shirtBgLoaded.value = true;
      draw();
    };
  });
  const shirtBgLoaded = ref(false);
  shirtBg.onload = () => {
    shirtBgLoaded.value = true;
    draw();
  };

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
      // Draw the shirt background centered
      const scale = Math.min(canvasWidth / shirtBg.width, canvasHeight / shirtBg.height);
      const w = shirtBg.width * scale;
      const h = shirtBg.height * scale;
      ctx.drawImage(shirtBg, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h);
    } else {
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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
        ctx.drawImage(item.img, item.x, item.y, item.w, item.h);

        if (item.isSelected) {
          ctx.save();
          ctx.strokeStyle = '#0af';
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x, item.y, item.w, item.h);
          ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
          ctx.fillRect(item.x, item.y, item.w, item.h);
          selectedObject.value = item;
          ctx.restore();
        }
      } else if (obj.type === 'text') {
        const t = obj as any;
        // layout
        const block = layoutTextBlock(ctx, t);

        // styles
        ctx.font = `${block.pxSize}px ${t.font}`;
        ctx.fillStyle = t.color;
        ctx.strokeStyle = t.outlineColor;
        ctx.lineWidth = t.outlineWidth;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = t.alignment;

        // draw lines
        let y = t.y;
        for (let i = 0; i < block.lines.length; i++) {
          const ln = block.lines[i];
          const startX = block.lineX[i];
          ctx.fillText(ln, startX, y);
          if (t.outlineColor && t.outlineColor !== 'None' && t.outlineWidth > 0) {
            ctx.strokeText(ln, startX, y);
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
          selectedObject.value = t;
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
        if (x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h) {
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
      const handles: [number, number][] = [
        [item.x, item.y],                         // TL (delete)
        [item.x + item.w, item.y],                // TR (resize)
        [item.x, item.y + item.h],                // BL (duplicate)
        [item.x + item.w, item.y + item.h],       // BR (rotate)
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
      // Anchor at bottom-left
      const [anchorX, anchorY] = [item.x, item.y + item.h];
      // Calculate new width and maintain aspect ratio
      let newW = x - anchorX;
      newW = Math.max(20, newW); // minimum width
      let newH = newW / item.aspect;
      // Clamp to grid bounds
      const grid = clothingDetails.value.grid;
      const maxW = grid.x + grid.w - anchorX;
      const maxH = anchorY - grid.y;
      if (newW > maxW) {
        newW = maxW;
        newH = newW / item.aspect;
      }
      if (newH > maxH) {
        newH = maxH;
        newW = newH * item.aspect;
      }
      item.w = newW;
      item.h = newH;
      // Keep bottom-left anchor fixed
      item.y = anchorY - item.h;
      item.isSelected = true;
      draw();
      return;
    }
    if (draggingIndex === -1) return;
    const item = images[draggingIndex];
    item.x = x - dragOffset.x;
    item.y = y - dragOffset.y;

    // Constrain position to guide area when dragging
    item.x = Math.max(clothingDetails.value.grid.x, Math.min(item.x, clothingDetails.value.grid.x + clothingDetails.value.grid.w - item.w));
    item.y = Math.max(clothingDetails.value.grid.y, Math.min(item.y, clothingDetails.value.grid.y + clothingDetails.value.grid.h - item.h));

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
      });

      draw();
    }
  }

  // TODO: Add watcher or reactive logic to update selected text object when text tab values change

  function updateClothing(details: any) {
    if (!details || !details.grid) return;
    clothingDetails.value = details;
    // Use first color's background as shirt background if available
    if (details.colors && details.colors[0]?.background) {
      shirtBg.onload = () => {
        shirtBgLoaded.value = true;
        draw();
      };
      shirtBg.src = details.colors[0].background;
    }
    // Update grid limits by reference
    // (the draw function always uses clothingDetails.value.grid)
    // Clear placed images
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

  defineExpose({
    openFileDialog, updateClothing, uploadObject, selectedObject, draw, centerSelectedText, duplicateSelectedText,
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
