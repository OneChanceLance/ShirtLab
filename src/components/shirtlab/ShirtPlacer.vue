<template>
  <div class="page">
    <div class="lab-container" style="position:relative;">
      <input ref="fileInput" type="file" accept="image/*" multiple @change="onFileChange" style="display:none;" />

      <canvas ref="canvas" :width="canvasWidth" :height="canvasHeight" style="display:block;"
        :style="{ cursor: canvasCursor }" @mousedown="startDrag" @mousemove="onMove" @mouseup="stopDrag" />
      <div
        v-if="coverageOverlayStyle"
        class="pricing-coverage-outline"
        :style="coverageOverlayStyle"
      />
      <div class="design-inspector" :class="{ 'design-inspector--collapsed': !inspectorOpen }">
        <button class="design-inspector__toggle" type="button" @click="toggleInspector">
          {{ inspectorOpen ? 'Hide inspector' : 'Show inspector' }}
        </button>
        <div v-if="inspectorOpen" class="design-inspector__panel">
          <header class="design-inspector__header">
            <div>
              <span class="design-inspector__title">{{ selectedView }} inventory</span>
              <small class="design-inspector__subtitle">
                {{ inspectorSummary.elementsCount }} item{{ inspectorSummary.elementsCount === 1 ? '' : 's' }}
              </small>
            </div>
          </header>
          <div class="design-inspector__metrics">
            <div class="design-inspector__metric">
              <span class="design-inspector__metric-label">Grid</span>
              <strong>
                {{ formatInches(inspectorSummary.grid.widthInches) }} ×
                {{ formatInches(inspectorSummary.grid.heightInches) }}
              </strong>
            </div>
            <div class="design-inspector__metric">
              <span class="design-inspector__metric-label">Bounds</span>
              <strong v-if="inspectorSummary.bounds.widthInches !== null">
                {{ formatInches(inspectorSummary.bounds.widthInches) }} ×
                {{ formatInches(inspectorSummary.bounds.heightInches) }}
              </strong>
              <strong v-else>—</strong>
            </div>
            <div class="design-inspector__metric">
              <span class="design-inspector__metric-label">Coverage</span>
              <strong>{{ formatPercent(inspectorSummary.coverageRatio) }}</strong>
            </div>
            <div class="design-inspector__metric">
              <span class="design-inspector__metric-label">Total area</span>
              <strong>{{ formatArea(inspectorSummary.sumAreaSquareInches) }}</strong>
            </div>
          </div>
          <ul class="design-inspector__list">
            <li v-for="item in inspectorItems" :key="item.id" :class="{ 'is-active': item.id === selectedInspectorId }"
              class="design-inspector__row" @click="handleInspectorSelect(item.id)">
              <div class="design-inspector__item-info">
                <span class="design-inspector__item-title">{{ inspectorItemLabel(item) }}</span>
                <small class="design-inspector__item-meta">{{ inspectorItemMeta(item) }}</small>
              </div>
              <span class="design-inspector__item-position">
                {{ Math.round(item.position.x) }},{{ Math.round(item.position.y) }}
              </span>
            </li>
            <li v-if="!inspectorItems.length" class="design-inspector__empty">No elements placed.</li>
          </ul>
        </div>
      </div>
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
        <ViewPort label="Front" :is-active="selectedView === 'Front'"
          :preview-src="frontPreview || viewToSrc.Front || fallbackPreview" @select="handleViewSelect" />
        <ViewPort label="Back" :is-active="selectedView === 'Back'"
          :preview-src="backPreview || viewToSrc.Back || viewToSrc.Front || fallbackPreview"
          @select="handleViewSelect" />
      </div>

      <button v-if="changeButtonVisible" type="button" class="sidebar__button" @click="requestGarmentChange">
        Change Garment
      </button>
      <button type="button" class="sidebar__button" @click="toggleGrid">
        {{ showGrid ? 'Hide Grid' : 'Show Grid' }}
      </button>

    </div>

  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, watch, ref, reactive } from 'vue';

  import DeleteIcon from 'vue-material-design-icons/Close.vue'
  import DuplicateIcon from 'vue-material-design-icons/ContentDuplicate.vue'
  import ResizeIcon from 'vue-material-design-icons/CropFree.vue'
  import ArrowLeftRight from 'vue-material-design-icons/ArrowLeftRight.vue'
  import RotateIcon from 'vue-material-design-icons/RotateRight.vue'
  import ViewPort from '../../components/shirtlab/Viewports/ViewPort.vue';
  import type { TextObject, ImageObject, ElementType, ElementVariant } from './types'
  // ADD with the other imports
  import { withDefaults, getEffectTransform, getEffectAdvance, applyToContext } from '../sideMenu/types/effectsList';
  import { getAABB, getAABBCorners, getRotatedCorners, pointInRotatedRect } from './utils/geometry';
  import { useDesignLayers } from './composables/useDesignLayers';
  import { createGridState, hydrateSizeMeasurements, type DesignGrid, type View } from './composables/useGrid';
  import { useCheckoutStore } from '../../stores/checkout';
  import type {
    SerializedDesignState,
    SerializedImageObject,
    SerializedTextObject,
    SerializedDesignView,
  } from '../../types/designState';

  const props = defineProps<{
    clothing?: {
      name?: string;
      front?: string;    // URL for front garment image
      back?: string;     // URL for back garment image
      side?: string;     // URL for sleeve/side garment image
      grid?: {
        x: number;
        y: number;
        w: number;
        h: number;
        widthInches?: number;
        heightInches?: number;
        dpi?: number;
        pxPerInch?: number;
        pixelsPerInch?: number;
        auto?: boolean;
        autoGenerated?: boolean;
      };
      colors?: Array<{ background?: string; sideUrl?: string; side?: string }>; // legacy fallback
    }
    showChangeGarmentButton?: boolean;
  }>();

  const emit = defineEmits<{
    (event: 'request-change-garment'): void;
  }>();

  function requestGarmentChange() {
    emit('request-change-garment');
  }

  const changeButtonVisible = computed(() => props.showChangeGarmentButton !== false);



  // Icon component array for handle buttons
  const iconComponents = [DeleteIcon, ResizeIcon, DuplicateIcon, RotateIcon];
  const textIconComponents = [DeleteIcon, ArrowLeftRight, DuplicateIcon, RotateIcon];
  const fallbackPreview = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const checkoutStore = useCheckoutStore();

  // -----------------------------------------------------
  // Reactive State & Composables
  // -----------------------------------------------------

  /**
   * Runtime bookkeeping for drag/resize interactions across canvas object types.
   */
  const dragState = reactive({
    text: {
      isResizing: false,
      index: -1,
      offset: { x: 0, y: 0 },
    },
    image: {
      index: -1,
      resizeHandle: -1,
      resizingIndex: -1,
      offset: { x: 0, y: 0 },
    },
    guide: {
      isDragging: false,
      handle: -1,
      offset: { x: 0, y: 0 },
    },
  });

  const coverageBounds = ref<{ x: number; y: number; w: number; h: number } | null>(null);
  const coverageOverlayStyle = computed(() => {
    const bounds = coverageBounds.value;
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;
    return {
      left: `${Math.round(bounds.x)}px`,
      top: `${Math.round(bounds.y)}px`,
      width: `${Math.round(bounds.w)}px`,
      height: `${Math.round(bounds.h)}px`,
    };
  });
  const DEFAULT_PIXELS_PER_INCH = 40;

  interface InspectorItem {
    id: string;
    type: 'image' | 'text';
    elementType: ElementType;
    elementVariant?: ElementVariant | null;
    name: string;
    widthInches: number | null;
    heightInches: number | null;
    areaSquareInches: number | null;
    position: { x: number; y: number };
    rotation: number;
    z: number;
    view: View;
  }

  interface InspectorSummary {
    view: View;
    elementsCount: number;
    sumAreaSquareInches: number | null;
    coverageRatio: number | null;
    bounds: {
      widthInches: number | null;
      heightInches: number | null;
      areaSquareInches: number | null;
    };
    grid: {
      widthInches: number | null;
      heightInches: number | null;
      areaSquareInches: number | null;
    };
  }

  type InspectorSnapshot = {
    items: InspectorItem[];
    summary: InspectorSummary;
  };

  function createEmptySummary(view: View): InspectorSummary {
    return {
      view,
      elementsCount: 0,
      sumAreaSquareInches: null,
      coverageRatio: null,
      bounds: {
        widthInches: null,
        heightInches: null,
        areaSquareInches: null,
      },
      grid: {
        widthInches: null,
        heightInches: null,
        areaSquareInches: null,
      },
    };
  }

  const inspectorState = reactive<Record<View, InspectorSnapshot>>({
    Front: { items: [], summary: createEmptySummary('Front') },
    Back: { items: [], summary: createEmptySummary('Back') },
  });
  const inspectorOpen = ref(true);

  const activeInspector = computed(() => inspectorState[selectedView.value]);
  const inspectorItems = computed(() => activeInspector.value?.items ?? []);
  const inspectorSummary = computed(() => activeInspector.value?.summary ?? createEmptySummary(selectedView.value));
  const selectedInspectorId = computed(() => selectedObject.value?.id ?? null);


  // at top-level (script setup)
  let onWinMove: ((e: MouseEvent) => void) | null = null;
  let onWinUp: ((e: MouseEvent) => void) | null = null;

  /**
   * Begins resizing a text object by wiring global mouse listeners to the drag loop.
   */
  function handleTextMouseDown(index: number, event: MouseEvent) {
    event.preventDefault();
    if (index !== 1) return; // only BR resize
    if (!selectedObject.value || selectedObject.value.type !== 'text') return;

    dragState.text.isResizing = true;
    mouseDown.value = true;

    // global listeners so drag works even though we started on a DOM handle
    onWinMove = (e) => onDrag(e as unknown as MouseEvent);
    onWinUp = () => stopDrag();

    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
  }

  /**
   * Samples the garment edges to approximate its dominant background colour.
   */
  function estimateBackgroundColor(data: Uint8ClampedArray, width: number, height: number) {
    const samples = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
      [Math.floor(width * 0.5), 0],
      [Math.floor(width * 0.5), height - 1],
      [0, Math.floor(height * 0.5)],
      [width - 1, Math.floor(height * 0.5)],
    ];
    let r = 0, g = 0, b = 0, count = 0;
    for (const [x, y] of samples) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 10) continue;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count += 1;
    }
    if (!count) return null;
    return { r: r / count, g: g / count, b: b / count };
  }

  /**
   * Detects a printable grid from the garment image and updates measurements accordingly.
   */
  function autoFitGridFromBackground() {
    if (!shirtBgLoaded.value) return;
    const iw = (shirtBg as any).naturalWidth || shirtBg.width;
    const ih = (shirtBg as any).naturalHeight || shirtBg.height;
    if (!iw || !ih) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = iw;
    offscreen.height = ih;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    try {
      offCtx.drawImage(shirtBg, 0, 0, iw, ih);
    } catch (err) {
      console.warn('[ShirtPlacer] Failed to draw shirt image for auto grid', err);
      return;
    }

    let imageData: ImageData;
    try {
      imageData = offCtx.getImageData(0, 0, iw, ih);
    } catch (err) {
      console.warn('[ShirtPlacer] Unable to read pixel data for auto grid (likely cross-origin)', err);
      return;
    }

    const background = estimateBackgroundColor(imageData.data, iw, ih);
    if (!background) return;

    const step = Math.max(1, Math.floor(Math.min(iw, ih) / 600));
    const threshold = 45;

    let minX = iw, maxX = -1, minY = ih, maxY = -1;
    const rowEdges: Array<{ y: number; left: number; right: number }> = [];

    for (let y = 0; y < ih; y += step) {
      let rowLeft = iw;
      let rowRight = -1;
      for (let x = 0; x < iw; x += step) {
        const idx = (y * iw + x) * 4;
        const alpha = imageData.data[idx + 3];
        if (alpha < 32) continue;
        const diff = Math.abs(imageData.data[idx] - background.r)
          + Math.abs(imageData.data[idx + 1] - background.g)
          + Math.abs(imageData.data[idx + 2] - background.b);
        if (diff > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x < rowLeft) rowLeft = x;
          if (x > rowRight) rowRight = x;
        }
      }
      if (rowRight >= rowLeft && rowRight !== -1) {
        rowEdges.push({ y, left: rowLeft, right: rowRight });
      }
    }

    if (maxX <= minX || maxY <= minY) {
      console.warn('[ShirtPlacer] auto grid detection failed: could not detect garment bounds');
      return;
    }

    const height = maxY - minY;
    const torsoRows = rowEdges.filter(row => row.y >= minY + height * 0.35 && row.y <= minY + height * 0.75);
    let torsoLeft = minX;
    let torsoRight = maxX;
    if (torsoRows.length) {
      torsoLeft = torsoRows.reduce((sum, row) => sum + row.left, 0) / torsoRows.length;
      torsoRight = torsoRows.reduce((sum, row) => sum + row.right, 0) / torsoRows.length;
    }

    const torsoWidth = Math.max(1, torsoRight - torsoLeft);
    const sideInset = torsoWidth * 0.08;
    const gridLeft = Math.max(minX, torsoLeft + sideInset);
    const gridRight = Math.min(maxX, torsoRight - sideInset);

    const topInset = height * 0.1;
    const bottomInset = height * 0.07;
    const gridTop = minY + topInset;
    const gridBottom = maxY - bottomInset;

    if (gridRight <= gridLeft || gridBottom <= gridTop) {
      console.warn('[ShirtPlacer] auto grid detection produced invalid bounds');
      return;
    }

    lastDetectionMetrics.garmentWidthPx = Math.max(0, torsoRight - torsoLeft);
    lastDetectionMetrics.garmentHeightPx = Math.max(0, maxY - minY);
    lastDetectionMetrics.gridWidthPx = Math.max(0, gridRight - gridLeft);
    lastDetectionMetrics.gridHeightPx = Math.max(0, gridBottom - gridTop);

    const { scale, offsetX, offsetY } = computeShirtTransform(iw, ih);
    const canvasLeft = offsetX + gridLeft * scale;
    const canvasTop = offsetY + gridTop * scale;
    let canvasWidthPx = (gridRight - gridLeft) * scale;
    let canvasHeightPx = (gridBottom - gridTop) * scale;

    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
    const clampedLeft = clamp(canvasLeft, 0, canvasWidth - 50);
    const clampedTop = clamp(canvasTop, 0, canvasHeight - 50);
    canvasWidthPx = Math.max(60, Math.min(canvasWidthPx, canvasWidth - clampedLeft));
    canvasHeightPx = Math.max(60, Math.min(canvasHeightPx, canvasHeight - clampedTop));

    const widthInches = clothingDetails.value.grid.widthInches ?? 12;
    const heightInches = clothingDetails.value.grid.heightInches
      ?? Number((widthInches * (canvasHeightPx / Math.max(canvasWidthPx, 1))).toFixed(2));

    clothingDetails.value.grid = {
      ...resolveGrid(),
      x: clampedLeft,
      y: clampedTop,
      w: canvasWidthPx,
      h: canvasHeightPx,
      widthInches,
      heightInches,
      autoGenerated: true,
      auto: true,
    } as DesignGrid & Record<string, any>;

    requestMeasurementRefresh();

    cancelAutoGridMeasurement();
    draw();
  }

  /**
   * Computes the visual handle position for a selected text block.
   */
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

  /**
   * Executes selected text toolbar actions like delete, duplicate, or rotate.
   */
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

  const {
    images,
    texts,
    selectedObject,
    zCounter,
    getAllObjectsByZ,
    rebalanceZ,
    getZExtrema,
    deselectAll,
  } = useDesignLayers();
  // Translate item so its rotated AABB stays fully inside the grid
  function clampIntoGrid(item: { x: number; y: number; w: number; h: number; rotation?: number }) {
    const grid = resolveGrid();
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

  /**
   * Handles clicks on image toolbar handles (resize/delete/duplicate/rotate).
   */
  function handleMouseDown(index: number, event: MouseEvent) {
    event.preventDefault();
    if (index === 1) { // Only for resize handle
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
          dragState.image.resizeHandle = 1;
          dragState.image.resizingIndex = i;
          mouseDown.value = true;
          return;
        }
      }
    }
  }

  /**
   * Executes image-level actions triggered through the floating toolbar.
   */
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


  // Guide area constants
  const selectedView = ref<View>('Front');

  const DEFAULT_GRID: DesignGrid = {
    x: 175,
    y: 75,
    w: 250,
    h: 450,
    widthInches: undefined,
    heightInches: undefined,
    dpi: null,
    auto: null,
    autoGenerated: null,
  };
  const viewGridState = reactive<Record<View, DesignGrid>>({
    Front: { ...DEFAULT_GRID },
    Back: { ...DEFAULT_GRID },
  });
  const viewGridInitialized = reactive<Record<View, boolean>>({
    Front: true,
    Back: false,
  });

  // -----------------------------------------------------
  // Grid Configuration & Measurement Helpers
  // -----------------------------------------------------

  const {
    showGrid,
    clothingDetails,
    lastDetectionMetrics,
    resolveGrid,
    markGridManual,
    shouldAutoDetect,
    requestMeasurementRefresh,
    getPixelsPerInch,
    resetClothingDetails,
  } = createGridState(DEFAULT_GRID);

  function resolveEffectiveDpi(grid: DesignGrid): number | null {
    const candidateValues = [
      (grid as any).dpi,
      (grid as any).pxPerInch,
      (grid as any).pixelsPerInch,
    ];
    for (const raw of candidateValues) {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    const widthInches = Number(grid.widthInches);
    if (Number.isFinite(widthInches) && widthInches > 0 && grid.w > 0) {
      return grid.w / widthInches;
    }

    const heightInches = Number(grid.heightInches);
    if (Number.isFinite(heightInches) && heightInches > 0 && grid.h > 0) {
      return grid.h / heightInches;
    }

    const derived = getPixelsPerInch();
    return Number.isFinite(derived) && derived > 0 ? derived : null;
  }

  function numericOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function numbersAreClose(a: unknown, b: unknown, tolerance: number): boolean {
    const aVal = numericOrNull(a);
    const bVal = numericOrNull(b);
    if (aVal === null && bVal === null) return true;
    if (aVal === null || bVal === null) return false;
    return Math.abs(aVal - bVal) <= tolerance;
  }

  function gridsAreEquivalent(
    current: Record<string, any> | null | undefined,
    next: Record<string, any>,
  ): boolean {
    if (!current) return false;
    const numericComparisons: Array<{ key: string; tolerance: number }> = [
      { key: 'x', tolerance: 0.25 },
      { key: 'y', tolerance: 0.25 },
      { key: 'w', tolerance: 0.25 },
      { key: 'h', tolerance: 0.25 },
      { key: 'widthInches', tolerance: 0.02 },
      { key: 'heightInches', tolerance: 0.02 },
      { key: 'dpi', tolerance: 0.02 },
      { key: 'pxPerInch', tolerance: 0.02 },
      { key: 'pixelsPerInch', tolerance: 0.02 },
    ];
    for (const { key, tolerance } of numericComparisons) {
      if (!numbersAreClose((current as any)[key], (next as any)[key], tolerance)) {
        return false;
      }
    }
    const nullableKeys: Array<'auto' | 'autoGenerated'> = ['auto', 'autoGenerated'];
    for (const key of nullableKeys) {
      const currentValue = (current as any)[key];
      const nextValue = (next as any)[key];
      if ((currentValue ?? null) !== (nextValue ?? null)) {
        return false;
      }
    }
    return true;
  }

  function syncGridToCheckoutStore(grid: DesignGrid) {
    const effectiveDpi = resolveEffectiveDpi(grid);
    const definition = checkoutStore.clothingDefinition ?? null;
    const currentGrid = definition && typeof definition.grid === 'object'
      ? (definition.grid as Record<string, any>)
      : null;

    const nextGrid: Record<string, any> = currentGrid ? { ...currentGrid } : {};
    nextGrid.x = grid.x;
    nextGrid.y = grid.y;
    nextGrid.w = grid.w;
    nextGrid.h = grid.h;
    nextGrid.auto = grid.auto ?? null;
    nextGrid.autoGenerated = grid.autoGenerated ?? null;

    const widthInches = Number(grid.widthInches);
    nextGrid.widthInches = Number.isFinite(widthInches) && widthInches > 0 ? widthInches : null;

    const heightInches = Number(grid.heightInches);
    nextGrid.heightInches = Number.isFinite(heightInches) && heightInches > 0 ? heightInches : null;

    if (typeof effectiveDpi === 'number' && Number.isFinite(effectiveDpi) && effectiveDpi > 0) {
      const rounded = Number(effectiveDpi.toFixed(2));
      nextGrid.dpi = rounded;
      nextGrid.pxPerInch = rounded;
      nextGrid.pixelsPerInch = rounded;
    }

    if (gridsAreEquivalent(currentGrid, nextGrid)) {
      return;
    }

    const nextDefinition = {
      ...(definition ?? {}),
      grid: nextGrid,
    };
    checkoutStore.setClothingDefinition(nextDefinition);
  }

  function toggleGrid() {
    showGrid.value = !showGrid.value;
  }

  // -----------------------------------------------------
  // View Management
  // -----------------------------------------------------

  /**
   * Persists current view state, switches to the requested view, and refreshes the canvas.
   */
  function switchView(next: View, options: { skipStore?: boolean } = {}) {
    const { skipStore = false } = options;
    // Allow switching even if already on the side, always store state and update preview
    const previous = selectedView.value;
    const previousGrid = resolveGrid();
    viewGridState[previous] = { ...previousGrid };
    viewGridInitialized[previous] = true;
    if (!viewGridInitialized[next]) {
      viewGridState[next] = { ...previousGrid };
      viewGridInitialized[next] = true;
    }
    if (!skipStore) {
      storeViewState(previous);
      updatePreviewFor(previous, { skipBackground: !shirtBgLoaded.value });
    }

    selectedView.value = next;
    const savedGrid = viewGridState[next] ?? DEFAULT_GRID;
    clothingDetails.value.grid = { ...DEFAULT_GRID, ...savedGrid };
    setShirtBackground(viewToSrc[next] || viewToSrc.Front || '', { mirror: viewMirrored[next] });
    loadViewState(next);
    requestAutoGrid(false);
  }

  /**
   * Maps UI labels to internal view keys and forwards to `switchView`.
   */
  function handleViewSelect(label: string) {
    let view: View = 'Front';
    if (label === 'Back') view = 'Back';
    switchView(view);
  }

  /**
   * Horizontally centers the active text block within the current grid bounds.
   */
  function centerSelectedText() {
    const t = selectedObject.value;
    if (!t || t.type !== 'text') return;

    const ctx = canvas.value?.getContext('2d');
    if (!ctx) return;

    const block = layoutTextBlock(ctx, t);
    const grid = clothingDetails.value.grid;

    t.x = grid.x + (grid.w - block.width) / 2;

    draw();
  }

  /**
   * Clones the active text block with a slight offset for quick iteration.
   */
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

  /**
   * Raises the active object to the top of the z-stack.
   */
  function bringSelectedForward() {
    const sel = selectedObject.value as any;
    if (!sel) return;
    const { maxZ } = getZExtrema();
    sel.z = (maxZ || 0) + 1;
    rebalanceZ();
    draw();
  }

  /**
   * Sends the active object to the back of the z-stack.
   */
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
  /**
   * Reacts to external "selectClothing" events from the surrounding application.
   */
  function handleClothingSelect(details: any) {
    if (!details) return;
    updateClothing(details);

    resetDesignState('Front');
    setShirtBackground(viewToSrc.Front || '', { mirror: viewMirrored.Front });
    draw();
  }

  const clothingSelectionHandler: EventListener = (event: Event) => {
    const custom = event as CustomEvent;
    handleClothingSelect(custom.detail);
  };

  const fileInput = ref<HTMLInputElement | null>(null);

  // -----------------------------------------------------
  // Canvas Setup & Background Assets
  // -----------------------------------------------------

  const mouseDown = ref(false);

  const canvas = ref<HTMLCanvasElement | null>(null);
  const canvasWidth = 600;
  const canvasHeight = 600;
  const BACKGROUND_VERTICAL_OFFSET = -150;

  const pendingAutoGrid = ref(false);
  let autoGridFrame: number | null = null;

  /**
   * Schedules automatic grid detection once the background image is available.
   */
  function requestAutoGrid(immediate = false) {
    if (!shouldAutoDetect()) return;
    pendingAutoGrid.value = true;
    if (immediate && shirtBgLoaded.value) {
      scheduleAutoGridMeasurement();
    }
  }

  /**
   * Executes auto grid measurement on the next animation frame, if pending.
   */
  function scheduleAutoGridMeasurement() {
    if (!pendingAutoGrid.value || !shirtBgLoaded.value) return;
    if (autoGridFrame !== null) return;
    autoGridFrame = requestAnimationFrame(() => {
      autoGridFrame = null;
      if (!pendingAutoGrid.value) return;
      autoFitGridFromBackground();
      pendingAutoGrid.value = false;
    });
  }

  function cancelAutoGridMeasurement() {
    if (autoGridFrame !== null) {
      cancelAnimationFrame(autoGridFrame);
      autoGridFrame = null;
    }
  }

  const canvasCursor = ref("default");
  const shirtBgLoaded = ref(false);
  const shirtBgError = ref<string | null>(null);
  const shirtBgMirrored = ref(false);
  const shirtBg = new window.Image();
  shirtBg.crossOrigin = 'anonymous';

  /**
   * Loads the garment image, wiring success/error handling and auto-detect refresh.
   */
  function setShirtBackground(src?: string | null, options: { mirror?: boolean } = {}) {
    const next = src || '';
    shirtBgLoaded.value = false;
    shirtBgError.value = null;
    shirtBgMirrored.value = Boolean(options.mirror);

    if (!next) {
      shirtBg.src = '';
      draw();
      cancelAutoGridMeasurement();
      pendingAutoGrid.value = false;
      return;
    }

    shirtBg.onload = () => {
      shirtBgLoaded.value = true;
      shirtBgError.value = null;
      draw();
      scheduleAutoGridMeasurement();
    };
    shirtBg.onerror = () => {
      shirtBgLoaded.value = false;
      shirtBgError.value = `Failed to load shirt image: ${next}`;
      draw();
      cancelAutoGridMeasurement();
      pendingAutoGrid.value = false;
    };
    shirtBg.src = next;
  }

  // ---- Garment background transform (for fine alignment) ----
  const bgTransform = reactive({ offsetX: 0, offsetY: 150, scale: 1 });
  /**
   * Applies manual background adjustments and requests a fresh auto grid.
   */
  function setBackgroundTransform(t: { offsetX?: number; offsetY?: number; scale?: number }) {
    if (typeof t.offsetX === 'number') bgTransform.offsetX = t.offsetX;
    if (typeof t.offsetY === 'number') bgTransform.offsetY = t.offsetY;
    if (typeof t.scale === 'number') bgTransform.scale = t.scale;
    draw();
    requestAutoGrid(true);
  }

  // -----------------------------------------------------
  const ALL_VIEWS: View[] = ['Front', 'Back'];

  // View Asset Mapping & Previews
  // -----------------------------------------------------

  const viewToSrc = reactive<Record<View, string>>({
    Front: props.clothing?.front || props.clothing?.colors?.[0]?.background || '',
    Back: props.clothing?.back || props.clothing?.front || props.clothing?.colors?.[0]?.background || '',
  });
  const viewMirrored = reactive<Record<View, boolean>>({
    Front: false,
    Back: false,
  });
  const viewStates: Record<View, { images: ImageObject[]; texts: TextObject[] }> = {
    Front: { images: [], texts: [] },
    Back: { images: [], texts: [] },
  };

  const frontPreview = ref<string>('');
  const backPreview = ref<string>('');
  const frontBlankPreview = ref<string>('');
  const backBlankPreview = ref<string>('');
  const frontCanvasPreview = ref<string>('');
  const backCanvasPreview = ref<string>('');

  function hasDesignForView(view: View): boolean {
    if (view === selectedView.value) {
      if (images.length > 0 || texts.length > 0) {
        return true;
      }
    }
    const state = viewStates[view];
    if (!state) return false;
    return (state.images?.length ?? 0) > 0 || (state.texts?.length ?? 0) > 0;
  }

  watch(frontPreview, (url) => {
    const hasDesign = hasDesignForView('Front');
    checkoutStore.setDesignPreview('Front', hasDesign ? (url || null) : null);
    if (!hasDesign) {
      checkoutStore.setBlankDesignPreview('Front', null);
      checkoutStore.setCanvasPreview('Front', null);
    }
  }, { immediate: true });

  watch(backPreview, (url) => {
    const hasDesign = hasDesignForView('Back');
    checkoutStore.setDesignPreview('Back', hasDesign ? (url || null) : null);
    if (!hasDesign) {
      checkoutStore.setBlankDesignPreview('Back', null);
      checkoutStore.setCanvasPreview('Back', null);
    }
  }, { immediate: true });

  watch(frontBlankPreview, (url) => {
    if (!hasDesignForView('Front')) {
      checkoutStore.setBlankDesignPreview('Front', null);
      return;
    }
    checkoutStore.setBlankDesignPreview('Front', url || null);
  }, { immediate: true });

  watch(backBlankPreview, (url) => {
    if (!hasDesignForView('Back')) {
      checkoutStore.setBlankDesignPreview('Back', null);
      return;
    }
    checkoutStore.setBlankDesignPreview('Back', url || null);
  }, { immediate: true });

  watch(frontCanvasPreview, (url) => {
    if (!hasDesignForView('Front')) {
      checkoutStore.setCanvasPreview('Front', null);
      return;
    }
    checkoutStore.setCanvasPreview('Front', url || null);
  }, { immediate: true });

  watch(backCanvasPreview, (url) => {
    if (!hasDesignForView('Back')) {
      checkoutStore.setCanvasPreview('Back', null);
      return;
    }
    checkoutStore.setCanvasPreview('Back', url || null);
  }, { immediate: true });

  watch(selectedView, (view) => {
    checkoutStore.setActiveDesignView(view);
  }, { immediate: true });

  function syncDesignState() {
    try {
      const state = exportDesignState();
      checkoutStore.setDesignState(state);
    } catch (error) {
      console.warn('[ShirtPlacer] Failed to sync design state', error);
    }
  }

  function refreshAllPreviews() {
    for (const view of ALL_VIEWS) {
      const src = viewToSrc[view] || fallbackPreview;
      setPreview(view, { designUrl: src, blankUrl: '', canvasUrl: src });
    }
    syncDesignState();
  }

  type PreviewPayload = {
    designUrl: string;
    blankUrl?: string | null;
    canvasUrl?: string | null;
  };

  function setPreview(view: View, payload: PreviewPayload) {
    const { designUrl, blankUrl = null, canvasUrl = null } = payload;
    if (view === 'Front') {
      frontPreview.value = designUrl;
      frontBlankPreview.value = blankUrl ?? '';
      frontCanvasPreview.value = canvasUrl ?? '';
    } else if (view === 'Back') {
      backPreview.value = designUrl;
      backBlankPreview.value = blankUrl ?? '';
      backCanvasPreview.value = canvasUrl ?? '';
    }
  }

  function inferImageElementType(source: any): ElementType {
    if (typeof source?.elementType === 'string') return source.elementType as ElementType;
    if (source?.shapeMeta) return 'shape';
    if (typeof source?.name === 'string' && source.name.startsWith('shape:')) return 'shape';
    if (typeof source?.name === 'string' && source.name.includes(':')) return 'icon';
    return 'image';
  }

  function inferImageVariant(source: any, elementType: ElementType): ElementVariant | undefined {
    if (typeof source?.elementVariant === 'string' && source.elementVariant.length) {
      return source.elementVariant;
    }
    if (elementType === 'shape') {
      if (typeof source?.shapeMeta?.key === 'string') return source.shapeMeta.key;
      if (typeof source?.name === 'string' && source.name.startsWith('shape:')) {
        return source.name.split(':')[1] || 'shape';
      }
      return 'shape';
    }
    if (elementType === 'icon') {
      if (typeof source?.name === 'string') {
        const [, variant] = source.name.split(':');
        if (variant) return variant;
      }
      return source?.isVector ? 'svg' : 'icon';
    }
    return source?.isVector ? 'svg' : 'bitmap';
  }

  function inferImageName(source: any, elementType: ElementType, variant?: ElementVariant | null): string {
    const provided = typeof source?.name === 'string' ? source.name : undefined;
    return buildImageDisplayName(elementType, variant, provided);
  }

  function normalizeImageObject(source: SerializedImageObject | ImageObject, view: View): ImageObject {
    const elementType = inferImageElementType(source);
    const elementVariant = inferImageVariant(source, elementType);
    const name = inferImageName(source, elementType, elementVariant);
    return {
      ...(source as ImageObject),
      img: undefined,
      showHandles: (source as ImageObject).showHandles ?? true,
      isSelected: false,
      shapeMeta: source.shapeMeta ? { ...source.shapeMeta } : undefined,
      elementType,
      elementVariant,
      name,
      view: (source as ImageObject).view ?? view,
    };
  }

  function inferTextVariant(source: SerializedTextObject | TextObject): ElementVariant | undefined {
    if (typeof (source as TextObject).elementVariant === 'string' && (source as TextObject).elementVariant!.length) {
      return (source as TextObject).elementVariant;
    }
    if (typeof source.font === 'string') return source.font;
    return undefined;
  }

  function inferTextName(source: SerializedTextObject | TextObject): string {
    if (typeof (source as TextObject).name === 'string' && (source as TextObject).name!.trim().length) {
      return (source as TextObject).name as string;
    }
    const text = (source as TextObject).content ?? '';
    return text ? text.slice(0, 24) : 'Text';
  }

  function normalizeTextObject(source: SerializedTextObject | TextObject, view: View): TextObject {
    const elementVariant = inferTextVariant(source);
    return {
      ...(source as TextObject),
      showHandles: (source as TextObject).showHandles ?? true,
      isSelected: false,
      effect: {
        name: source.effect?.name ?? 'none',
        options: withDefaults(source.effect?.name ?? 'none', source.effect?.options),
      },
      elementType: (source as TextObject).elementType ?? 'text',
      elementVariant: elementVariant ?? undefined,
      name: inferTextName(source),
      view: (source as TextObject).view ?? view,
    };
  }

  function cloneImageObject(item: ImageObject, viewOverride?: View): ImageObject {
    return normalizeImageObject(
      {
        ...item,
        imgUrl: item.imgUrl,
        view: viewOverride ?? item.view,
      },
      viewOverride ?? item.view ?? selectedView.value,
    );
  }

  function cloneTextObject(item: TextObject, viewOverride?: View): TextObject {
    return normalizeTextObject(
      {
        ...item,
        effect: {
          ...item.effect,
          options: { ...item.effect.options },
        },
        view: viewOverride ?? item.view,
      },
      viewOverride ?? item.view ?? selectedView.value,
    );
  }

  function serializeImageObject(item: ImageObject): SerializedImageObject {
    const { img, isSelected, showHandles, ...rest } = item;
    return {
      ...rest,
      imgUrl: item.imgUrl,
      showHandles: showHandles ?? true,
      isVector: item.isVector ?? rest.isVector,
      name: item.name,
      shapeMeta: item.shapeMeta ? { ...item.shapeMeta } : undefined,
    };
  }

  function serializeTextObject(item: TextObject): SerializedTextObject {
    const { isSelected, showHandles, effect, ...rest } = item;
    const safeEffect = effect || { name: 'none', options: withDefaults('none') };
    return {
      ...rest,
      showHandles: showHandles ?? true,
      effect: {
        name: safeEffect.name,
        options: { ...withDefaults(safeEffect.name, safeEffect.options) },
      },
    };
  }

  function deserializeImageObject(source: SerializedImageObject, view: View): ImageObject {
    return normalizeImageObject(source, view);
  }

  function deserializeTextObject(source: SerializedTextObject, view: View): TextObject {
    return normalizeTextObject(source, view);
  }

  function exportDesignState(): SerializedDesignState {
    storeViewState(selectedView.value);
    const buildView = (view: View): SerializedDesignView => {
      const state = viewStates[view] ?? { images: [], texts: [] };
      return {
        images: state.images.map(serializeImageObject),
        texts: state.texts.map(serializeTextObject),
      };
    };
    return {
      activeView: selectedView.value,
      views: {
        Front: buildView('Front'),
        Back: buildView('Back'),
      },
    };
  }

  function applyDesignState(state: SerializedDesignState | null) {
    if (!state) {
      resetDesignState('Front');
      return;
    }

    const nextViews = state.views ?? { Front: { images: [], texts: [] }, Back: { images: [], texts: [] } };
    viewStates.Front = {
      images: (nextViews.Front?.images ?? []).map((img) => deserializeImageObject(img, 'Front')),
      texts: (nextViews.Front?.texts ?? []).map((txt) => deserializeTextObject(txt, 'Front')),
    };
    viewStates.Back = {
      images: (nextViews.Back?.images ?? []).map((img) => deserializeImageObject(img, 'Back')),
      texts: (nextViews.Back?.texts ?? []).map((txt) => deserializeTextObject(txt, 'Back')),
    };

    const targetView = (state.activeView === 'Back' ? 'Back' : 'Front') as View;
    selectedView.value = targetView;
    loadViewState(targetView);
    refreshAllPreviews();
    draw();
  }

  /**
   * Clears previews, selections, and per-view caches before loading a new garment/view.
   */
  function resetDesignState(target: View = 'Front') {
    images.splice(0, images.length);
    texts.splice(0, texts.length);
    viewStates.Front = { images: [], texts: [] };
    viewStates.Back = { images: [], texts: [] };
    frontPreview.value = '';
    backPreview.value = '';
    selectedObject.value = null;
    storeViewState('Front');
    selectedView.value = target;
    loadViewState(target);
  }

  function storeViewState(view: View) {
    const state = viewStates[view];
    state.images = images.map((img) => cloneImageObject(img, view));
    state.texts = texts.map((txt) => cloneTextObject(txt, view));
  }

  function loadViewState(view: View) {
    const state = viewStates[view] ?? { images: [], texts: [] };
    images.splice(0, images.length, ...state.images.map((img) => cloneImageObject(img, view)));
    texts.splice(0, texts.length, ...state.texts.map((txt) => cloneTextObject(txt, view)));
    selectedObject.value = null;
    images.forEach((img) => (img.isSelected = false));
    texts.forEach((txt) => (txt.isSelected = false));
    const { maxZ } = getZExtrema();
    zCounter.value = (isFinite(maxZ) ? maxZ : 0) + 1;

    // Rehydrate <img> for each image (CORS-safe)
    for (const img of images) {
      if (img && img.imgUrl) {
        const imageEl = new Image();
        imageEl.crossOrigin = 'anonymous';
        imageEl.src = img.imgUrl as any;
        imageEl.onload = () => {
          (img as any).img = imageEl;
          draw(); // redraw as each image loads
        };
      }
    }

    draw();
  }

  function updatePreviewFor(view: View, { skipBackground = false } = {}) {
    storeViewState(view);
    if (skipBackground) return;
    // Build a full-canvas preview (background + objects only; no grid or rulers)
    const buildFull = (
      ctx: CanvasRenderingContext2D,
      includeBackground: boolean,
      options: { fillColor?: string | null } = {},
    ) => {
      const { fillColor = '#ffffff' } = options;
      // 1) Background (shirt), optional to avoid CORS taint
      if (includeBackground && !skipBackground) {
        try {
          drawShirtBg(ctx);
        } catch (e) {
          console.warn('[updatePreviewFor] drawShirtBg failed in preview:', e);
        }
      } else if (typeof fillColor === 'string') {
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // 2) (Omit grid lines and rulers for preview images)
      // (Grid and rulers intentionally omitted in preview.)

      // 3) Objects (images + text) in z-order
      const ordered = getAllObjectsByZ() as Array<any>;
      for (const obj of ordered) {
        if (obj.type === 'image') {
          const item = obj as any;
          if (!item.img || !(item.img instanceof Image)) continue; // skip until loaded

          ctx.save();
          const cx = item.x + item.w / 2;
          const cy = item.y + item.h / 2;
          ctx.translate(cx, cy);
          ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
          ctx.drawImage(item.img, -item.w / 2, -item.h / 2, item.w, item.h);
          ctx.restore();
        } else if (obj.type === 'text') {
          const t = obj as any;
          const block = layoutTextBlock(ctx, t);
          const eff = t.effect && t.effect.name ? t.effect : { name: 'none', options: withDefaults('none') };
          const effName = eff.name;
          const effOpts = withDefaults(eff.name, eff.options);

          ctx.font = `${block.pxSize}px ${t.font}`;
          ctx.fillStyle = t.color;
          ctx.strokeStyle = t.outlineColor;
          ctx.lineWidth = t.outlineWidth;
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = t.alignment;

          let y = t.y;
          for (let li = 0; li < block.lines.length; li++) {
            const ln = block.lines[li];
            const anchor = block.lineX[li];
            const chars = Array.from(ln);
            if (!chars.length) { y += block.lineHeight; continue; }

            const advances = chars.map(ch => ctx.measureText(ch).width);
            let cursorX = (() => {
              if (t.alignment === 'center') return anchor - (advances.reduce((a, b) => a + b, 0)) / 2;
              if (t.alignment === 'right') return anchor - (advances.reduce((a, b) => a + b, 0));
              return anchor;
            })();

            for (let i = 0; i < chars.length; i++) {
              const ch = chars[i];
              const tr = getEffectTransform(effName, i, chars.length, effOpts);
              ctx.save();
              applyToContext(ctx, cursorX, y, tr, 0, 0);
              ctx.fillText(ch, 0, 0);
              if (t.outlineColor && t.outlineColor !== 'None' && t.outlineWidth > 0) {
                ctx.strokeText(ch, 0, 0);
              }
              ctx.restore();
              cursorX += advances[i];
            }

            y += block.lineHeight;
          }
        }
      }
    };

    // Helper: Crop a canvas to the non-transparent content
    function cropCanvasToContent(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
      const ctx = sourceCanvas.getContext('2d');
      if (!ctx) return sourceCanvas;
      const { width, height } = sourceCanvas;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          if (data[idx + 3] > 0) { // alpha > 0 means not transparent
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      // If no non-transparent pixel found, return a 1x1 transparent canvas
      if (maxX < minX || maxY < minY) {
        const empty = document.createElement('canvas');
        empty.width = 1;
        empty.height = 1;
        return empty;
      }
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) return sourceCanvas;
      croppedCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      return croppedCanvas;
    }

    function createBlankDataUrl(width: number, height: number): string {
      const safeWidth = Math.max(1, Math.floor(width));
      const safeHeight = Math.max(1, Math.floor(height));
      const blankCanvas = document.createElement('canvas');
      blankCanvas.width = safeWidth;
      blankCanvas.height = safeHeight;
      const blankCtx = blankCanvas.getContext('2d');
      if (blankCtx) {
        blankCtx.fillStyle = '#ffffff';
        blankCtx.fillRect(0, 0, safeWidth, safeHeight);
      }
      return blankCanvas.toDataURL('image/png');
    }

    try {
      // Always build an offscreen preview (never clone live canvas directly)
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = canvasWidth;
      previewCanvas.height = canvasHeight;
      const ctx = previewCanvas.getContext('2d');
      if (!ctx) return;

      let canvasUrl: string | null = null;
      try {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        buildFull(ctx, false, { fillColor: null });
        canvasUrl = previewCanvas.toDataURL('image/png');
      } catch (printErr) {
        console.warn('[updatePreviewFor] Failed to capture full canvas preview; continuing without print canvas.', printErr);
        canvasUrl = null;
      }

      // Attempt with background included for display thumbnails
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      buildFull(ctx, true, { fillColor: '#ffffff' });
      try {
        const cropped = cropCanvasToContent(previewCanvas);
        const designUrl = cropped.toDataURL('image/png');
        const blankUrl = createBlankDataUrl(cropped.width, cropped.height);
        setPreview(view, { designUrl, blankUrl, canvasUrl: canvasUrl ?? designUrl });
        syncDesignState();
        return;
      } catch (bgErr) {
        console.warn('[updatePreviewFor] toDataURL failed with background (likely CORS). Falling back to no background.', bgErr);
      }

      // Fallback: rebuild without background to avoid taint
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      buildFull(ctx, false, { fillColor: '#ffffff' });
      const cropped = cropCanvasToContent(previewCanvas);
      const designUrl = cropped.toDataURL('image/png');
      const blankUrl = createBlankDataUrl(cropped.width, cropped.height);
      setPreview(view, { designUrl, blankUrl, canvasUrl: canvasUrl ?? designUrl });
      syncDesignState();
    } catch (err) {
      console.warn('[updatePreviewFor] failed to build full-canvas preview:', err);
    }
  }

  /**
   * Reads image uploads and routes them through the unified object pipeline.
   */
  function onFileChange(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        // Use uploadObject for image
        const result = ev.target?.result;
        if (typeof result === 'string') {
          uploadObject('image', { imgUrl: result });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Returns the scaled placement of the garment image within the canvas viewport.
   */
  function computeShirtTransform(imageWidth: number, imageHeight: number) {
    const iw = Math.max(1, imageWidth);
    const ih = Math.max(1, imageHeight);
    const baseScale = Math.min(canvasWidth / iw, canvasHeight / ih);
    const scale = baseScale * (bgTransform.scale || 1);
    const width = iw * scale;
    const height = ih * scale;
    const offsetX = (canvasWidth - width) / 2 + (bgTransform.offsetX || 0);
    const offsetY = (canvasHeight - height) / 2 + (bgTransform.offsetY || 0) + BACKGROUND_VERTICAL_OFFSET;
    return { scale, width, height, offsetX, offsetY };
  }

  /**
   * Renders the current garment image or a fallback when unavailable.
   */
  function drawShirtBg(ctx: CanvasRenderingContext2D) {
    if (shirtBgLoaded.value) {
      const iw = (shirtBg as any).naturalWidth || shirtBg.width || 1;
      const ih = (shirtBg as any).naturalHeight || shirtBg.height || 1;
      const { width, height, offsetX, offsetY } = computeShirtTransform(iw, ih);
      if (shirtBgMirrored.value) {
        ctx.save();
        ctx.translate(offsetX + width, offsetY);
        ctx.scale(-1, 1);
        ctx.drawImage(shirtBg, 0, 0, width, height);
        ctx.restore();
      } else {
        ctx.drawImage(shirtBg, offsetX, offsetY, width, height);
      }
    } else if (shirtBgError.value) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Image unavailable', canvasWidth / 2, canvasHeight / 2);
    }
  }

  // --- Text wrapping + measurement helper ---
  // --- Text wrapping + measurement helper (now wraps long words) ---
  // --- Text wrapping + measurement helper (no double-push, breaks long words) ---
  // Glyph-tight layout that accounts for overshoots (H, J, swashes, etc.)
  // Glyph-tight layout + word wrap + alignment
  // Word-only wrap (no letter-by-letter splits, no hyphens)
  /**
   * Performs glyph-aware word wrapping and metrics gathering for a text object.
   */
  function layoutTextBlock(ctx: CanvasRenderingContext2D, t: TextObject) {
    const basePx = Math.max(1, getPixelsPerInch());
    const pxSize = t.size * basePx;
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

  function isMultiple(value: number, unit: number, epsilon = 0.1) {
    if (!unit || !Number.isFinite(unit)) return false;
    const scaled = value / unit;
    return Math.abs(scaled - Math.round(scaled)) <= epsilon;
  }

  // Draw rulers (call after grid lines, before objects)
  /**
   * Draws inch-based rulers around the active grid using the current DPI estimate.
   */
  function drawRulers(ctx: CanvasRenderingContext2D, gridX: number, gridY: number, gridWidth: number, gridHeight: number) {
    const inchPx = getPixelsPerInch();
    if (!Number.isFinite(inchPx) || inchPx <= 0) return;

    const quarterStep = inchPx / 4;
    if (!Number.isFinite(quarterStep) || quarterStep <= 0.5) return;

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.font = '10px "Anek Latin", sans-serif';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 1;

    const maxX = gridWidth + quarterStep / 2;
    const maxY = gridHeight + quarterStep / 2;

    // Top ruler
    ctx.textAlign = 'center';
    for (let offset = 0; offset <= maxX; offset += quarterStep) {
      const px = gridX + offset;
      const isInch = isMultiple(offset, inchPx);
      const isHalf = !isInch && isMultiple(offset, inchPx / 2);
      const tickHeight = isInch ? 10 : (isHalf ? 7 : 4);
      ctx.beginPath();
      ctx.moveTo(px, gridY);
      ctx.lineTo(px, gridY - tickHeight);
      ctx.stroke();
      if (isInch && offset > 0) {
        const inches = offset / inchPx;
        const label = inches.toFixed(1).replace(/\.0$/, '');
        ctx.fillText(label, px, gridY - 25);
      }
    }

    // Left ruler
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let offset = 0; offset <= maxY; offset += quarterStep) {
      const py = gridY + offset;
      const isInch = isMultiple(offset, inchPx);
      const isHalf = !isInch && isMultiple(offset, inchPx / 2);
      const tickWidth = isInch ? 10 : (isHalf ? 7 : 4);
      ctx.beginPath();
      ctx.moveTo(gridX, py);
      ctx.lineTo(gridX - tickWidth, py);
      ctx.stroke();
      if (isInch && offset > 0) {
        const inches = offset / inchPx;
        const label = inches.toFixed(1).replace(/\.0$/, '');
        ctx.fillText(label, gridX - 15, py);
      }
    }

    ctx.restore();
  }

  /**
   * Main canvas renderer combining background, guides, and ordered objects.
   */
  function draw() {
    const ctx = canvas.value?.getContext('2d');
    if (!ctx) {
      if (coverageBounds.value !== null) {
        coverageBounds.value = null;
      }
      return;
    }

    const coverageTracker = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };

    const captureCoverage = (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      if (
        !Number.isFinite(bounds.minX) ||
        !Number.isFinite(bounds.minY) ||
        !Number.isFinite(bounds.maxX) ||
        !Number.isFinite(bounds.maxY)
      ) {
        return;
      }
      coverageTracker.minX = Math.min(coverageTracker.minX, bounds.minX);
      coverageTracker.minY = Math.min(coverageTracker.minY, bounds.minY);
      coverageTracker.maxX = Math.max(coverageTracker.maxX, bounds.maxX);
      coverageTracker.maxY = Math.max(coverageTracker.maxY, bounds.maxY);
    };

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawShirtBg(ctx);

    const gridRect = resolveGrid();
    const gridWidthPx = gridRect.w;
    const gridHeightPx = gridRect.h;
    const gridDetails = clothingDetails.value.grid ?? {};
    const rawGridWidthInches = toNumeric((gridDetails as any).widthInches ?? (gridDetails as any).physicalWidth ?? (gridDetails as any).widthIn ?? (gridDetails as any).width_in);
    const rawGridHeightInches = toNumeric((gridDetails as any).heightInches ?? (gridDetails as any).physicalHeight ?? (gridDetails as any).heightIn ?? (gridDetails as any).height_in);
    const gridPpi = getPixelsPerInch();
    const effectivePpi = Number.isFinite(gridPpi) && gridPpi > 0 ? gridPpi : DEFAULT_PIXELS_PER_INCH;
    const gridWidthInches = rawGridWidthInches ?? (gridWidthPx > 0 ? gridWidthPx / effectivePpi : null);
    const gridHeightInches = rawGridHeightInches ?? (gridHeightPx > 0 ? gridHeightPx / effectivePpi : null);
    const gridAreaInches = gridWidthInches && gridHeightInches ? gridWidthInches * gridHeightInches : null;

    const convertPixelsToInches = (px: number): number => px / effectivePpi;
    const convertWidthPx = (px: number): number => convertPixelsToInches(px);
    const convertHeightPx = (px: number): number => convertPixelsToInches(px);

    const inspectorItems: InspectorItem[] = [];
    let inspectorAreaSum = 0;

    if (showGrid.value) {
      // Draw grid
      ctx.save();
      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 1;
      const inchPx = getPixelsPerInch();
      const candidateStep = inchPx / 2;
      const gridStep = (Number.isFinite(candidateStep) && candidateStep > 4) ? candidateStep : 40;
      for (let x = gridRect.x; x <= gridRect.x + gridRect.w; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, gridRect.y);
        ctx.lineTo(x, gridRect.y + gridRect.h);
        ctx.stroke();
      }
      for (let y = gridRect.y; y <= gridRect.y + gridRect.h; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gridRect.x, y);
        ctx.lineTo(gridRect.x + gridRect.w, y);
        ctx.stroke();
      }
      // Draw guide border
      ctx.strokeStyle = "#4af";
      ctx.lineWidth = 2;
      ctx.strokeRect(gridRect.x, gridRect.y, gridRect.w, gridRect.h);

      // Draw boundary resize handles if creating


      ctx.restore();

      // --- Draw rulers after grid, before objects ---
      drawRulers(
        ctx,
        gridRect.x,
        gridRect.y,
        gridRect.w,
        gridRect.h
      );
    }

    // --- Unified z-ordered rendering of images and text ---
    const ordered = getAllObjectsByZ() as Array<any>;
    for (const obj of ordered) {
      if (obj.type === 'image') {
        const item = obj as any;
        // Skip until the img element exists
        if (!item.img || !(item.img instanceof Image)) continue;

        ctx.globalAlpha = 1;
        ctx.save();
        const cx = item.x + item.w / 2;
        const cy = item.y + item.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        // draw the image centered in its frame; frame size stays constant
        ctx.drawImage(item.img, -item.w / 2, -item.h / 2, item.w, item.h);
        ctx.restore();

        const imageBounds = getAABB({
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          rotation: item.rotation ?? 0,
        });
        captureCoverage(imageBounds);

        const widthInches = convertWidthPx(item.w);
        const heightInches = convertHeightPx(item.h);
        const areaSquareInches = Number.isFinite(widthInches) && Number.isFinite(heightInches)
          ? widthInches * heightInches
          : null;
        if (typeof areaSquareInches === 'number' && Number.isFinite(areaSquareInches)) {
          inspectorAreaSum += areaSquareInches;
        }
        inspectorItems.push({
          id: item.id,
          type: 'image',
          elementType: item.elementType ?? 'image',
          elementVariant: item.elementVariant ?? null,
          name: typeof item.name === 'string' && item.name.trim().length ? item.name : 'Graphic',
          widthInches: Number.isFinite(widthInches) ? widthInches : null,
          heightInches: Number.isFinite(heightInches) ? heightInches : null,
          areaSquareInches: typeof areaSquareInches === 'number' && Number.isFinite(areaSquareInches) ? areaSquareInches : null,
          position: { x: item.x, y: item.y },
          rotation: item.rotation ?? 0,
          z: Number(item.z ?? 0),
          view: selectedView.value,
        });

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

        const textBounds = getAABB({
          x: block.boundsLeft,
          y: block.boundsTop,
          w: block.width,
          h: block.height,
          rotation: t.rotation ?? 0,
        });
        captureCoverage(textBounds);

        const textWidthInches = convertWidthPx(block.width);
        const textHeightInches = convertHeightPx(block.height);
        const textAreaInches = Number.isFinite(textWidthInches) && Number.isFinite(textHeightInches)
          ? textWidthInches * textHeightInches
          : null;
        if (typeof textAreaInches === 'number' && Number.isFinite(textAreaInches)) {
          inspectorAreaSum += textAreaInches;
        }
        inspectorItems.push({
          id: t.id,
          type: 'text',
          elementType: t.elementType ?? 'text',
          elementVariant: t.elementVariant ?? t.font ?? null,
          name: typeof t.name === 'string' && t.name.trim().length ? t.name : (String(t.content ?? '') || 'Text'),
          widthInches: Number.isFinite(textWidthInches) ? textWidthInches : null,
          heightInches: Number.isFinite(textHeightInches) ? textHeightInches : null,
          areaSquareInches: typeof textAreaInches === 'number' && Number.isFinite(textAreaInches) ? textAreaInches : null,
          position: { x: t.x, y: t.y },
          rotation: t.rotation ?? 0,
          z: Number(t.z ?? 0),
          view: selectedView.value,
        });

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
          const extras = chars.map(() => getEffectAdvance(effName));
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

    const hasCoverage =
      Number.isFinite(coverageTracker.minX) &&
      Number.isFinite(coverageTracker.minY) &&
      Number.isFinite(coverageTracker.maxX) &&
      Number.isFinite(coverageTracker.maxY) &&
      coverageTracker.maxX > coverageTracker.minX &&
      coverageTracker.maxY > coverageTracker.minY;

    let boundingWidthInches: number | null = null;
    let boundingHeightInches: number | null = null;
    let boundingAreaInches: number | null = null;
    let coverageRatio: number | null = null;

    if (hasCoverage) {
      const boundingWidthPx = Math.max(0, coverageTracker.maxX - coverageTracker.minX);
      const boundingHeightPx = Math.max(0, coverageTracker.maxY - coverageTracker.minY);
      boundingWidthInches = convertWidthPx(boundingWidthPx);
      boundingHeightInches = convertHeightPx(boundingHeightPx);
      boundingAreaInches = Number.isFinite(boundingWidthInches) && Number.isFinite(boundingHeightInches)
        ? boundingWidthInches * boundingHeightInches
        : null;
      coverageRatio = gridAreaInches && boundingAreaInches
        ? Math.min(1, boundingAreaInches / gridAreaInches)
        : null;

      const nextBounds = {
        x: coverageTracker.minX,
        y: coverageTracker.minY,
        w: boundingWidthPx,
        h: boundingHeightPx,
      };
      const prevBounds = coverageBounds.value;
      const tolerance = 0.4;
      const changed = !prevBounds ||
        Math.abs(prevBounds.x - nextBounds.x) > tolerance ||
        Math.abs(prevBounds.y - nextBounds.y) > tolerance ||
        Math.abs(prevBounds.w - nextBounds.w) > tolerance ||
        Math.abs(prevBounds.h - nextBounds.h) > tolerance;
      if (changed) {
        coverageBounds.value = nextBounds;
      }
    } else if (coverageBounds.value !== null) {
      coverageBounds.value = null;
    }

    const sumAreaSquareInches = inspectorItems.length && Number.isFinite(inspectorAreaSum)
      ? inspectorAreaSum
      : null;

    inspectorState[selectedView.value] = {
      items: inspectorItems,
      summary: {
        view: selectedView.value,
        elementsCount: inspectorItems.length,
        sumAreaSquareInches,
        coverageRatio,
        bounds: {
          widthInches: inspectorItems.length ? boundingWidthInches : null,
          heightInches: inspectorItems.length ? boundingHeightInches : null,
          areaSquareInches: inspectorItems.length ? boundingAreaInches : null,
        },
        grid: {
          widthInches: gridWidthInches,
          heightInches: gridHeightInches,
          areaSquareInches: gridAreaInches,
        },
      },
    };

    updatePreviewFor(selectedView.value, { skipBackground: !shirtBgLoaded.value });
  }



  onMounted(draw);

  /**
   * Hit-tests all drawable objects in z-order to find the top-most match.
   */
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


  /**
   * Updates the canvas cursor based on hovered handles or objects.
   */
  function onHover(e: MouseEvent) {
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;


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
  /**
   * Begins dragging for images or text depending on the hit-test result.
   */
  function startDrag(e: MouseEvent) {
    e.preventDefault();
    mouseDown.value = true;
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for guide boundary handles if in create mode


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
              dragState.image.resizeHandle = 1;
              dragState.image.resizingIndex = i;
              dragState.image.index = -1;
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
    images.forEach((img) => {
      img.isSelected = false;
    });
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
        dragState.text.index = found.index;
        dragState.text.offset.x = x - t.x;
        dragState.text.offset.y = y - t.y;
      }
    } else {
      selectedObject.value = null;
    }


    // Image clicked: start image drag
    dragState.image.index = imgIdx;

    if (imgIdx !== -1) {
      dragState.image.offset.x = x - images[imgIdx].x;
      dragState.image.offset.y = y - images[imgIdx].y;
    } else {
      dragState.image.offset.x = 0;
      dragState.image.offset.y = 0;
    }
    draw();
  }

  /**
   * Central drag loop handling text resizing, guide manipulation, and object movement.
   */
  function onDrag(e: MouseEvent) {
    // Hide handles while dragging text
    if (selectedObject.value?.type === 'text' && dragState.text.index !== -1) {
      // Temporarily hide handles while dragging
      selectedObject.value.showHandles = false;
    }

    // Text box resize (width-only; rewrap handles height)
    if (dragState.text.isResizing && selectedObject.value?.type === 'text') {
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
    e.preventDefault();
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // If dragging a text box, move it
    if (dragState.text.index !== -1) {
      const t = texts[dragState.text.index];
      // Move text based on drag offset
      t.x = x - dragState.text.offset.x;
      t.y = y - dragState.text.offset.y;

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
    if (dragState.guide.handle !== -1) {
      const xPos = x;
      const yPos = y;

      markGridManual();
      switch (dragState.guide.handle) {

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
    if (dragState.guide.isDragging) {
      const xPos = x;
      const yPos = y;
      markGridManual();
      clothingDetails.value.grid.x = xPos - dragState.guide.offset.x;
      clothingDetails.value.grid.y = yPos - dragState.guide.offset.y;
      draw();
      return;
    }

    // Only allow resizing from TR handle (index 1)
    if (dragState.image.resizeHandle === 1 && dragState.image.resizingIndex !== -1) {
      const item = images[dragState.image.resizingIndex];
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
    if (dragState.image.index === -1) return;
    const item = images[dragState.image.index];
    item.x = x - dragState.image.offset.x;
    item.y = y - dragState.image.offset.y;

    // Constrain position using rotated AABB so it stays inside grid
    clampIntoGrid(item);

    draw();
  }

  /**
   * Ends any active drag, resets cursor state, and cleans up window listeners.
   */
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
    dragState.image.index = -1;
    dragState.image.resizeHandle = -1;
    dragState.image.resizingIndex = -1;
    dragState.image.offset.x = 0;
    dragState.image.offset.y = 0;
    dragState.guide.handle = -1;
    dragState.guide.isDragging = false;
    dragState.guide.offset.x = 0;
    dragState.guide.offset.y = 0;
    dragState.text.isResizing = false;
    dragState.text.index = -1;
    dragState.text.offset.x = 0;
    dragState.text.offset.y = 0;
  }

  /**
   * Programmatically triggers the hidden file input to upload assets.
   */
  function openFileDialog() {
    fileInput.value?.click();
  }

  function resolveElementIdentity(type: 'image' | 'text', payload: any) {
    const providedType = typeof payload?.elementType === 'string' ? payload.elementType : null;
    const providedVariant = typeof payload?.elementVariant === 'string' ? payload.elementVariant : null;
    if (providedType) {
      return {
        elementType: providedType as any,
        elementVariant: providedVariant ?? undefined,
      };
    }
    if (type === 'text') {
      return {
        elementType: 'text' as const,
        elementVariant: Array.isArray(payload?.font) ? payload.font[0] : (payload?.font ?? undefined),
      };
    }
    if (payload?.shapeMeta || (typeof payload?.name === 'string' && payload.name.startsWith('shape:'))) {
      const keyFromMeta = payload?.shapeMeta?.key ?? (typeof payload?.name === 'string' ? payload.name.split(':')[1] : undefined);
      return {
        elementType: 'shape' as const,
        elementVariant: keyFromMeta ?? 'shape',
      };
    }
    if (typeof payload?.name === 'string' && payload.name.includes(':')) {
      const [, variant] = payload.name.split(':');
      return {
        elementType: 'icon' as const,
        elementVariant: variant ?? 'icon',
      };
    }
    const variant = payload?.isVector ? 'svg' : 'bitmap';
    return {
      elementType: 'image' as const,
      elementVariant: variant,
    };
  }

  function buildImageDisplayName(elementType: ElementType, elementVariant?: ElementVariant | null, providedName?: string | null | undefined) {
    const cleaned = typeof providedName === 'string' ? providedName.trim() : '';
    if (cleaned) {
      if (elementType === 'shape' && cleaned.startsWith('shape:')) {
        const key = cleaned.split(':')[1] || elementVariant || '';
        return key ? `Shape ${key}` : 'Shape';
      }
      if (elementType === 'icon' && cleaned.includes(':')) {
        const label = cleaned.split(':').pop();
        return label ? `Icon ${label}` : 'Icon';
      }
      return cleaned;
    }
    if (elementType === 'shape') {
      const key = elementVariant?.split(':').pop() ?? elementVariant ?? '';
      return key ? `Shape ${key}` : 'Shape';
    }
    if (elementType === 'icon') {
      const key = elementVariant?.split(':').pop() ?? elementVariant ?? '';
      return key ? `Icon ${key}` : 'Icon';
    }
    return elementVariant === 'svg' ? 'Vector Image' : 'Image';
  }

  function toNumeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function formatInches(value: number | null | undefined, decimals = 1): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return `${value.toFixed(decimals)}″`;
  }

  function formatArea(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return `${value.toFixed(1)} sq in`;
  }

  function formatPercent(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return `${(value * 100).toFixed(1)}%`;
  }

  function inspectorItemLabel(item: InspectorItem): string {
    const typeLabel = item.elementType
      ? `${item.elementType.charAt(0).toUpperCase()}${item.elementType.slice(1)}`
      : `${item.type.charAt(0).toUpperCase()}${item.type.slice(1)}`;
    const variantRaw = item.elementVariant ?? '';
    const variant =
      typeof variantRaw === 'string' && variantRaw.includes(':')
        ? variantRaw.split(':').pop()
        : variantRaw;
    const baseName = item.name && item.name.trim().length ? item.name.trim() : variant || typeLabel;
    return variant && variant !== baseName ? `${typeLabel} · ${baseName}` : `${typeLabel} · ${baseName}`;
  }

  function inspectorItemMeta(item: InspectorItem): string {
    const parts: string[] = [];
    if (typeof item.widthInches === 'number' && typeof item.heightInches === 'number') {
      parts.push(`${item.widthInches.toFixed(1)}″×${item.heightInches.toFixed(1)}″`);
    }
    if (typeof item.areaSquareInches === 'number') {
      parts.push(`${item.areaSquareInches.toFixed(1)} sq in`);
    }
    if (typeof item.rotation === 'number' && Math.abs(item.rotation) > 0.01) {
      parts.push(`${item.rotation.toFixed(0)}°`);
    }
    parts.push(`z${item.z}`);
    return parts.join(' · ');
  }

  function toggleInspector() {
    inspectorOpen.value = !inspectorOpen.value;
  }

  function handleInspectorSelect(id: string) {
    const targetImage = images.find((img) => img.id === id);
    const targetText = texts.find((txt) => txt.id === id);
    const target = targetImage ?? targetText ?? null;
    if (!target) return;
    deselectAll();
    target.isSelected = true;
    selectedObject.value = target as any;
    draw();
  }

  // Unified object upload (image/text) with correct type signatures
  /**
   * Creates text or image objects and inserts them into the shared layer stack.
   */
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
    if (type === 'image') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = payload.imgUrl;

      img.onload = () => {
        deselectAll();
        images.forEach((i) => (i.isSelected = false));

        const naturalWidth = img.naturalWidth || img.width || 1;
        const naturalHeight = img.naturalHeight || img.height || 1;

        const gridMetrics = resolveGrid();
        const gridWidth = Number.isFinite(gridMetrics.w) && gridMetrics.w > 0
          ? gridMetrics.w
          : canvasWidth;
        const gridHeight = Number.isFinite(gridMetrics.h) && gridMetrics.h > 0
          ? gridMetrics.h
          : canvasHeight;

        const maxWidth = gridWidth * 0.75;
        const maxHeight = gridHeight * 0.75;

        const gridX = Number.isFinite(gridMetrics.x)
          ? gridMetrics.x
          : (canvasWidth - gridWidth) / 2;
        const gridY = Number.isFinite(gridMetrics.y)
          ? gridMetrics.y
          : (canvasHeight - gridHeight) / 2;

        const scaleCandidates = [
          maxWidth / naturalWidth,
          maxHeight / naturalHeight,
          1,
        ];

        const validScales = scaleCandidates.filter((val) => Number.isFinite(val) && val > 0);
        const scale = validScales.length ? Math.min(...validScales) : 1;

        const w = Math.max(8, naturalWidth * scale);
        const h = Math.max(8, naturalHeight * scale);

        const centerX = gridX + (gridWidth - w) / 2;
        const centerY = gridY + (gridHeight - h) / 2;

        const aspect = naturalHeight !== 0 ? naturalWidth / naturalHeight : 1;

        const vectorHint = payload?.isVector ?? (typeof payload?.name === 'string' && payload.name.includes(':'));

        const identity = resolveElementIdentity('image', payload);

        const newImage = {
          id: crypto.randomUUID?.() || Date.now().toString(),
          type: 'image',
          imgUrl: payload.imgUrl,
          img,
          showHandles: true,
          x: centerX,
          y: centerY,
          w,
          h,
          aspect,
          origW: w,
          origH: h,
          isSelected: true,
          z: zCounter.value++,
          rotation: 0,
          isVector: Boolean(vectorHint),
          elementType: identity.elementType,
          elementVariant: identity.elementVariant ?? (vectorHint ? 'svg' : 'bitmap'),
          view: selectedView.value,
          name: buildImageDisplayName(identity.elementType, identity.elementVariant ?? (vectorHint ? 'svg' : 'bitmap'), payload?.name),
        } as ImageObject & Record<string, any>;

        if (payload?.shapeMeta) {
          newImage.shapeMeta = payload.shapeMeta;
        }

        images.push(newImage);

        draw();
      };
    }

    if (type === 'text') {
      texts.forEach(t => t.isSelected = false);

      const identity = resolveElementIdentity('text', payload);
      const fontValue = Array.isArray(payload?.font)
        ? payload.font[0]
        : (payload?.font ?? 'Arial');
      const textContent = typeof payload === 'string'
        ? payload
        : payload.value || payload.content || 'Sample Text';

      texts.push({
        id: crypto.randomUUID?.() || Date.now().toString(),
        type: 'text',
        content: textContent,
        font: fontValue,
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
        z: zCounter.value++,
        // 👇 NEW
        effect: { name: 'none', options: withDefaults('none') },
        name: typeof payload?.name === 'string'
          ? payload.name
          : textContent?.slice(0, 24) || 'Text',
        elementType: identity.elementType,
        elementVariant: identity.elementVariant ?? fontValue,
        view: selectedView.value,
      });

      draw();
    }
  }
  /**
   * Applies a new garment definition and refreshes dependent state (grid, previews, bg).
   */
  function updateClothing(details: any) {
    if (!details) return;

    const colorsArray = Array.isArray(details.colors) ? details.colors : [];
    const primaryColor = colorsArray[0] ?? {};
    const bg = typeof primaryColor?.background === 'string' ? primaryColor.background : undefined;
    const backgroundChange = Boolean(details.front || details.back || bg);
    const incomingGrid = details.grid as DesignGrid | undefined;

    if (incomingGrid) {
      const mergedGrid = {
        ...DEFAULT_GRID,
        ...incomingGrid,
      } as DesignGrid;
      clothingDetails.value.grid = { ...mergedGrid };
      viewGridState.Front = { ...mergedGrid };
      viewGridState.Back = { ...mergedGrid };
      viewGridInitialized.Front = true;
      viewGridInitialized.Back = true;
    } else {
      const currentGrid = resolveGrid();
      viewGridState.Front = { ...currentGrid };
      viewGridState.Back = { ...currentGrid };
    }

    if (!incomingGrid) {
      requestAutoGrid(!backgroundChange);
    }

    if (Object.prototype.hasOwnProperty.call(details, 'sizeMeasurements')) {
      clothingDetails.value.sizeMeasurements = hydrateSizeMeasurements(details.sizeMeasurements);
    }

    if (Object.prototype.hasOwnProperty.call(details, 'size')) {
      clothingDetails.value.size = typeof details.size === 'string' ? details.size : '';
    }

    const assignableKeys: Array<keyof typeof clothingDetails.value> = ['name', 'image', 'style', 'gender'];
    for (const key of assignableKeys) {
      if (Object.prototype.hasOwnProperty.call(details, key) && details[key] !== undefined) {
        (clothingDetails.value as any)[key] = details[key];
      }
    }

    if (backgroundChange) {
      if (details.front) viewToSrc.Front = details.front;
      if (details.back) {
        viewToSrc.Back = details.back;
      } else if (details.front) {
        viewToSrc.Back = details.front;
      }
      if (!details.front && !details.back && bg) {
        viewToSrc.Front = bg;
        viewToSrc.Back = bg;
      }
    }

    if (!backgroundChange && bg) {
      viewToSrc.Front = viewToSrc.Front || bg;
      viewToSrc.Back = viewToSrc.Back || bg;
    }

    if (!viewToSrc.Back) {
      viewToSrc.Back = viewToSrc.Front || '';
    }

    viewMirrored.Front = false;
    viewMirrored.Back = false;

    refreshAllPreviews();

    if (details.bgTransform) {
      setBackgroundTransform(details.bgTransform);
    }

    requestMeasurementRefresh();

    resetDesignState('Front');
    setShirtBackground(viewToSrc.Front || viewToSrc.Back || '', { mirror: viewMirrored.Front });
    draw();
  }

  /**
   * Resets the designer to its initial empty state.
   */
  function clearClothing() {
    resetClothingDetails();
    viewGridState.Front = { ...DEFAULT_GRID };
    viewGridState.Back = { ...DEFAULT_GRID };
    viewGridInitialized.Front = true;
    viewGridInitialized.Back = false;
    viewToSrc.Front = '';
    viewToSrc.Back = '';
    viewMirrored.Front = false;
    viewMirrored.Back = false;
    resetDesignState('Front');
    setShirtBackground('', { mirror: false });
    refreshAllPreviews();
    draw();
  }

  /**
   * Updates garment imagery from the outside world without altering other state.
   */
  function setClothingImages(imgs: { front?: string; back?: string; side?: string }) {
    if (imgs.front) viewToSrc.Front = imgs.front;
    if (imgs.back) {
      viewToSrc.Back = imgs.back;
    } else if (imgs.front) {
      viewToSrc.Back = imgs.front;
    }
    if (!viewToSrc.Back) {
      viewToSrc.Back = viewToSrc.Front || '';
    }
    viewMirrored.Front = false;
    viewMirrored.Back = false;
    requestAutoGrid();
    setShirtBackground(viewToSrc[selectedView.value] || viewToSrc.Front || '', { mirror: viewMirrored[selectedView.value] });
    refreshAllPreviews();
    draw();
  }

  // -----------------------------------------------------
  // Lifecycle & Watchers
  // -----------------------------------------------------

  onMounted(() => {
    storeViewState(selectedView.value);
    updatePreviewFor(selectedView.value, { skipBackground: !shirtBgLoaded.value });
    loadViewState(selectedView.value);
    setShirtBackground(viewToSrc[selectedView.value] || viewToSrc.Front || '', { mirror: viewMirrored[selectedView.value] });
    refreshAllPreviews();
    window.addEventListener('shirtlab-selectClothing', clothingSelectionHandler);
  });

  onUnmounted(() => {
    window.removeEventListener('shirtlab-selectClothing', clothingSelectionHandler);
  });

  watch(showGrid, () => {
    draw();
  });

  watch(() => clothingDetails.value.grid, (grid) => {
    const normalized = { ...DEFAULT_GRID, ...(grid || {}) } as DesignGrid;
    viewGridState[selectedView.value] = normalized;
    viewGridInitialized[selectedView.value] = true;
    syncGridToCheckoutStore(normalized);
    draw();
  }, { deep: true });

  watch(() => clothingDetails.value.size, () => {
    requestMeasurementRefresh();
  });

  watch(() => clothingDetails.value.sizeMeasurements, () => {
    requestMeasurementRefresh();
  }, { deep: true });

  watch(() => props.clothing, (details) => {
    if (details) {
      updateClothing(details);
    } else {
      clearClothing();
    }
  }, { immediate: true, deep: true });

  watch(selectedObject, (next) => {
    if (!next) return;
    const mirror = texts.find(txt => txt.id === next.id);
    if (mirror) {
      Object.assign(mirror, next);
      draw();
    }
  }, { deep: true });

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
    clearClothing,
    exportDesignState,
    applyDesignState,
  });


</script>

<style scoped lang="scss">

  .page {
    display: flex;
  }

  .lab-container {
    left: 40%;
  }

  .lab-container canvas {
    border: 2px solid #d1d5db;
    border-radius: 1.5rem;
    background-color: #ffffff;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  }

  .pricing-coverage-outline {
    position: absolute;
    z-index: 1;
    border: 2px dashed rgba(249, 115, 22, 0.85);
    border-radius: 1rem;
    background: rgba(249, 115, 22, 0.08);
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.18);
    transition: all 120ms ease;
  }

  .design-inspector {
    position: absolute;
    top: 1.2rem;
    right: 1.2rem;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    z-index: 3;
  }

  .design-inspector__toggle {
    padding: 0.35rem 0.9rem;
    border-radius: 9999px;
    border: none;
    background: rgba(15, 23, 42, 0.75);
    color: #fff;
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 160ms ease;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
  }

  .design-inspector__toggle:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
  }

  .design-inspector__panel {
    width: clamp(240px, 28vw, 320px);
    max-height: 340px;
    padding: 0.85rem;
    border-radius: 1.1rem;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
    border: 1px solid rgba(148, 163, 184, 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .design-inspector__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .design-inspector__title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #0f172a;
  }

  .design-inspector__subtitle {
    display: block;
    font-size: 0.7rem;
    color: #475569;
    margin-top: 0.15rem;
  }

  .design-inspector__metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .design-inspector__metric {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.75rem;
    color: #1f2937;
  }

  .design-inspector__metric-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #475569;
  }

  .design-inspector__list {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
  }

  .design-inspector__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.6rem;
    border-radius: 0.75rem;
    background: rgba(241, 245, 249, 0.7);
    cursor: pointer;
    transition: background 120ms ease, border 120ms ease;
    border: 1px solid transparent;
  }

  .design-inspector__row:hover {
    background: rgba(226, 232, 240, 0.9);
  }

  .design-inspector__row.is-active {
    border-color: rgba(59, 130, 246, 0.55);
    background: rgba(219, 234, 254, 0.85);
  }

  .design-inspector__item-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .design-inspector__item-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: #0f172a;
  }

  .design-inspector__item-meta {
    font-size: 0.68rem;
    color: #475569;
  }

  .design-inspector__item-position {
    font-size: 0.68rem;
    color: #64748b;
    white-space: nowrap;
  }

  .design-inspector__empty {
    text-align: center;
    font-size: 0.72rem;
    color: #64748b;
    padding: 0.4rem 0;
  }

  @media (max-width: 768px) {
    .design-inspector {
      top: auto;
      bottom: 0.8rem;
      right: 0.8rem;
      align-items: stretch;
    }

    .design-inspector__panel {
      width: min(95vw, 360px);
      max-height: 50vh;
    }

    .design-inspector__metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  * {
    user-select: none;
  }

  .canvas {
    position: absolute;
    z-index: 2;
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
    position: absolute;
    top: 1;
    right: 0rem;
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
  }

  .sidebar__button {
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
    overflow: hidden;
    will-change: transform, box-shadow, background;
    transform-origin: center;
    transition: transform 140ms ease, box-shadow 200ms ease, background 220ms ease;
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }

  .sidebar__button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    background: linear-gradient(180deg, #ffffff, #eef2f7);
  }

  .sidebar__button:active {
    transform: translateY(0) scale(0.98);
  }

  .sidebar__button::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(167, 197, 102, 0.35);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    pointer-events: none;
  }

  .sidebar__button:active::after {
    animation: ripple 420ms ease-out;
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
    .sidebar__button {
      transition: none;
    }

    .sidebar__button:active {
      transform: none;
    }

    .sidebar__button::after {
      animation: none !important;
    }
  }

  .viewport-frame {
    background-color: rgb(255, 255, 255);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.75rem;
  }

  /* Target any SVG inside a handle button */
  .canvas :deep(svg) {
    fill: rgb(167, 197, 102);
    /* green */
    stroke: rgb(167, 197, 102);
  }


</style>
