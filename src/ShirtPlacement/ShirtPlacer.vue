<template>
  <div class="lab-container" style="position:relative;">
    <input ref="fileInput" type="file" accept="image/*" multiple @change="onFileChange" style="display:none;" />
    <button @click="showGrid = !showGrid" style="margin-bottom: 12px;">
      {{ showGrid ? 'Hide Grid' : 'Show Grid' }}
    </button>
    <canvas
      ref="canvas"
      :width="canvasWidth"
      :height="canvasHeight"
      style="border:1px solid #ccc; display:block;"
      :style="{ cursor: canvasCursor }"
      @mousedown="startDrag"
      @mousemove="onMove"
      @mouseup="stopDrag"
      @mouseleave="stopDrag"
    />
    <div
      v-if="selectedImage"
      :style="{
        position: 'absolute',
        left: selectedImage.x + selectedImage.w - 12 + 'px',
        top: selectedImage.y - 24 + 'px',
        zIndex: 10,
        cursor: 'pointer',
        background: '#fff',
        borderRadius: '4px',
        padding: '2px 4px',
        boxShadow: '0 1px 6px #0001',
        fontSize: '18px',
        userSelect: 'none',
      }"
      @click="deleteSelectedImage"
    >
      🗑️
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref, reactive, computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useClothingStore } from '../stores/clothingStore';

const clothingStore = useClothingStore();

// Guide area constants
const showGrid = ref(true);

const clothingDetails = ref({
  name: '',
  image: '',
  grid: { x: 175, y: 150, w: 250, h: 400 },
  style: '',
  gender: '',
  size: ''
});

// Listen for clothing selection events from parent
// If using v-on="selectClothing" directly, receive as prop instead, or use event bus.
// Here, we'll assume you receive it as a prop or via a custom event.
function handleClothingSelect(details: any) {
  if (!details || !details.grid) return;
  clothingDetails.value = details;
  // Update shirt background if provided
  if (details.image) {
    shirtBg.src = details.image;
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

let guideX = clothingDetails.value.grid.x;
let guideY = clothingDetails.value.grid.y;
let guideW = clothingDetails.value.grid.w;
let guideH = clothingDetails.value.grid.h;

const mouseDown = ref(false);

const canvas = ref<HTMLCanvasElement | null>(null);
const canvasWidth = 600;
const canvasHeight = 800;

const canvasCursor = ref("default");

const shirtBg = new window.Image();
shirtBg.src = '/tshirt.jpg'; // put your shirt background image in /public
const shirtBgLoaded = ref(false);
shirtBg.onload = () => {
  shirtBgLoaded.value = true;
  draw();
};

// Each placed image object: { img, x, y, w, h, aspect, origW, origH, isSelected }
const images = reactive<any[]>([]);
let dragOffset = { x: 0, y: 0 };
let draggingIndex = -1;

let resizeHandleIndex = -1;
let resizingImageIndex = -1;
let resizeGuideHandle = -1;

// For dragging the guide boundary's center in create mode
let draggingGuide = false;
let guideDragOffset = { x: 0, y: 0 };

const selectedImage = computed(() =>
  images.find((img) => img.isSelected)
);

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
    reader.onload = function(ev) {
      const img = new window.Image();
      img.onload = () => {
        images.push({
          img,
          x: clothingDetails.value.grid.x + (clothingDetails.value.grid.w - Math.min(img.width / 3, clothingDetails.value.grid.w)) / 2,
          y: clothingDetails.value.grid.y + (clothingDetails.value.grid.h - Math.min(img.height / 3, clothingDetails.value.grid.h)) / 2,
          w: Math.min(img.width / 3, clothingDetails.value.grid.w),
          h: Math.min(img.height / 3, clothingDetails.value.grid.h),
          aspect: img.width / img.height,
          origW: img.width / 3,
          origH: img.height / 3,
          isSelected: false
        });
        draw();
      };
      img.src = ev.target?.result as string;
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
      const size = 14;
      const handles = [
        [clothingDetails.value.grid.x, clothingDetails.value.grid.y], // TL
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y], // TR
        [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // BL
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // BR
        // Sides
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y], // Top
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // Bottom
        [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Left
        [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Right
      ];
      ctx.fillStyle = '#f44';
      handles.forEach(([x, y]) => ctx.fillRect(x - size / 2, y - size / 2, size, size));
    }

    ctx.restore();
  }

  images.forEach((item) => {
    ctx.globalAlpha = 1;
    ctx.drawImage(item.img, item.x, item.y, item.w, item.h);

    if (item.isSelected) {
      ctx.save();
      ctx.strokeStyle = '#0af';
      ctx.lineWidth = 2;
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      const size = 14;
      const handles = [
        [item.x, item.y],
        [item.x + item.w, item.y],
        [item.x, item.y + item.h],
        [item.x + item.w, item.y + item.h],
      ];
      ctx.fillStyle = '#0af';
      handles.forEach(([x, y]) => ctx.fillRect(x - size / 2, y - size / 2, size, size));
      ctx.restore();
    }
  });
}

onMounted(draw);

function findImageAt(x: number, y: number) {
  // Topmost first (reverse order)
  for (let i = images.length - 1; i >= 0; i--) {
    const item = images[i];
    if (
      x >= item.x &&
      x <= item.x + item.w &&
      y >= item.y &&
      y <= item.y + item.h
    ) {
      return i;
    }
  }
  return -1;
}

function onHover(e: MouseEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check guide handles if creating
  if (clothingStore.isCreating) {
    const size = 20;
    const guideHandles = [
      [clothingDetails.value.grid.x, clothingDetails.value.grid.y], // TL
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y], // TR
      [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // BL
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // BR
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y], // Top
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w / 2, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // Bottom
      [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Left
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h / 2], // Right
    ];
    for (let h = 0; h < guideHandles.length; h++) {
      const [hx, hy] = guideHandles[h];
      if (x >= hx - size / 2 && x <= hx + size / 2 && y >= hy - size / 2 && y <= hy + size / 2) {
        switch (h) {
          case 0: case 3: // TL, BR
            canvasCursor.value = 'nwse-resize';
            break;
          case 1: case 2: // TR, BL
            canvasCursor.value = 'nesw-resize';
            break;
          case 4: case 5: // Top, Bottom
            canvasCursor.value = 'ns-resize';
            break;
          case 6: case 7: // Left, Right
            canvasCursor.value = 'ew-resize';
            break;
        }
        return;
      }
    }
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

  // Check image handles
  for (let i = images.length - 1; i >= 0; i--) {
    const item = images[i];
    const size = 28;
    const handles = [
      [item.x, item.y],
      [item.x + item.w, item.y],
      [item.x, item.y + item.h],
      [item.x + item.w, item.y + item.h],
    ];
    for (let h = 0; h < handles.length; h++) {
      const [hx, hy] = handles[h];
      if (x >= hx - size / 2 && x <= hx + size / 2 && y >= hy - size / 2 && y <= hy + size / 2) {
        if (h === 0 || h === 3) {
          canvasCursor.value = 'nwse-resize';
        } else {
          canvasCursor.value = 'nesw-resize';
        }
        return;
      }
    }
  }

  // Check if over any image
  const idx = findImageAt(x, y);
  if (idx !== -1) {
    canvasCursor.value = 'move';
    return;
  }

  // Default
  canvasCursor.value = 'default';
}

function onMove(e: MouseEvent) {
  if (mouseDown.value) {
    onDrag(e);
  } else {
    onHover(e);
  }
}

// Drag logic
function startDrag(e: MouseEvent) {
  mouseDown.value = true;
  const rect = canvas.value!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check for guide boundary handles if in create mode
  if (clothingStore.isCreating) {
    const size = 20;
    const guideHandles = [
      // Corners
      [clothingDetails.value.grid.x, clothingDetails.value.grid.y], // TL
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y], // TR
      [clothingDetails.value.grid.x, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // BL
      [clothingDetails.value.grid.x + clothingDetails.value.grid.w, clothingDetails.value.grid.y + clothingDetails.value.grid.h], // BR
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
    const size = 28;
    const handles = [
      [item.x, item.y], // TL
      [item.x + item.w, item.y], // TR
      [item.x, item.y + item.h], // BL
      [item.x + item.w, item.y + item.h], // BR
    ];
    for (let h = 0; h < handles.length; h++) {
      const [hx, hy] = handles[h];
      if (
        x >= hx - size / 2 &&
        x <= hx + size / 2 &&
        y >= hy - size / 2 &&
        y <= hy + size / 2
      ) {
        images.forEach((img, idx) => (img.isSelected = idx === i));
        resizeHandleIndex = h;
        resizingImageIndex = i;
        draggingIndex = -1;
        draw();
        return;
      }
    }
  }

  // If not resizing, check if mouse is inside any image (again, topmost first)
  const idx = findImageAt(x, y);
  images.forEach((img, i) => (img.isSelected = i === idx));
  if (idx !== -1) {
    draggingIndex = idx;
    dragOffset.x = x - images[idx].x;
    dragOffset.y = y - images[idx].y;
  } else {
    draggingIndex = -1;
  }
  resizeHandleIndex = -1;
  resizingImageIndex = -1;
  draw();
}

function onDrag(e: MouseEvent) {
  // Guide boundary resizing logic
  if (resizeGuideHandle !== -1) {
    const rect = canvas.value!.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    const yPos = e.clientY - rect.top;

    switch (resizeGuideHandle) {
      case 0: // TL
        clothingDetails.value.grid.w += clothingDetails.value.grid.x - xPos;
        clothingDetails.value.grid.h += clothingDetails.value.grid.y - yPos;
        clothingDetails.value.grid.x = xPos;
        clothingDetails.value.grid.y = yPos;
        break;
      case 1: // TR
        clothingDetails.value.grid.w = xPos - clothingDetails.value.grid.x;
        clothingDetails.value.grid.h += clothingDetails.value.grid.y - yPos;
        clothingDetails.value.grid.y = yPos;
        break;
      case 2: // BL
        clothingDetails.value.grid.w += clothingDetails.value.grid.x - xPos;
        clothingDetails.value.grid.x = xPos;
        clothingDetails.value.grid.h = yPos - clothingDetails.value.grid.y;
        break;
      case 3: // BR
        clothingDetails.value.grid.w = xPos - clothingDetails.value.grid.x;
        clothingDetails.value.grid.h = yPos - clothingDetails.value.grid.y;
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
    const rect = canvas.value!.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    const yPos = e.clientY - rect.top;

    clothingDetails.value.grid.x = xPos - guideDragOffset.x;
    clothingDetails.value.grid.y = yPos - guideDragOffset.y;

    draw();
    return;
  }

  if (resizeHandleIndex !== -1 && resizingImageIndex !== -1) {
    // existing image resize logic
    const item = images[resizingImageIndex];
    const rect = canvas.value!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let [anchorX, anchorY] = [item.x, item.y];
    switch (resizeHandleIndex) {
      case 0: // TL
        anchorX = item.x + item.w;
        anchorY = item.y + item.h;
        break;
      case 1: // TR
        anchorX = item.x;
        anchorY = item.y + item.h;
        break;
      case 2: // BL
        anchorX = item.x + item.w;
        anchorY = item.y;
        break;
      case 3: // BR
        anchorX = item.x;
        anchorY = item.y;
        break;
    }
    // Calculate new width and height, keeping aspect ratio
    let newW = Math.abs(x - anchorX);
    let newH = newW / item.aspect;

    // Prevent scaling bigger than guide area
    // If growing right or down
    let maxW = clothingDetails.value.grid.w;
    let maxH = clothingDetails.value.grid.h;

    // Clamp max width/height based on guide area and which corner is anchored
    if (resizeHandleIndex === 0) { // TL
      maxW = anchorX - clothingDetails.value.grid.x;
      maxH = anchorY - clothingDetails.value.grid.y;
    } else if (resizeHandleIndex === 1) { // TR
      maxW = clothingDetails.value.grid.x + clothingDetails.value.grid.w - anchorX;
      maxH = anchorY - clothingDetails.value.grid.y;
    } else if (resizeHandleIndex === 2) { // BL
      maxW = anchorX - clothingDetails.value.grid.x;
      maxH = clothingDetails.value.grid.y + clothingDetails.value.grid.h - anchorY;
    } else if (resizeHandleIndex === 3) { // BR
      maxW = clothingDetails.value.grid.x + clothingDetails.value.grid.w - anchorX;
      maxH = clothingDetails.value.grid.y + clothingDetails.value.grid.h - anchorY;
    }
    // Convert maxW/maxH to valid aspect-locked values
    maxW = Math.min(maxW, maxH * item.aspect);
    maxH = maxW / item.aspect;

    // Clamp to minimum and maximum
    newW = Math.max(20, Math.min(newW, maxW));
    newH = newW / item.aspect;

    // Update position and size based on handle
    switch (resizeHandleIndex) {
      case 0: // TL
        item.x = anchorX - newW;
        item.y = anchorY - newH;
        break;
      case 1: // TR
        item.y = anchorY - newH;
        break;
      case 2: // BL
        item.x = anchorX - newW;
        break;
      case 3: // BR
        break;
    }
    item.w = newW;
    item.h = newH;

    // Enforce staying within guide
    item.x = Math.max(clothingDetails.value.grid.x, Math.min(item.x, clothingDetails.value.grid.x + clothingDetails.value.grid.w - item.w));
    item.y = Math.max(clothingDetails.value.grid.y, Math.min(item.y, clothingDetails.value.grid.y + clothingDetails.value.grid.h - item.h));
    if (item.x < clothingDetails.value.grid.x) { item.w -= (clothingDetails.value.grid.x - item.x); item.x = clothingDetails.value.grid.x; }
    if (item.y < clothingDetails.value.grid.y) { item.h -= (clothingDetails.value.grid.y - item.y); item.y = clothingDetails.value.grid.y; }
    if (item.x + item.w > clothingDetails.value.grid.x + clothingDetails.value.grid.w) item.w = clothingDetails.value.grid.x + clothingDetails.value.grid.w - item.x;
    if (item.y + item.h > clothingDetails.value.grid.y + clothingDetails.value.grid.h) item.h = clothingDetails.value.grid.y + clothingDetails.value.grid.h - item.y;

    draw();
    return;
  }
  if (draggingIndex === -1) return;
  const rect = canvas.value!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const item = images[draggingIndex];
  item.x = x - dragOffset.x;
  item.y = y - dragOffset.y;

  // Constrain position to guide area when dragging
  item.x = Math.max(clothingDetails.value.grid.x, Math.min(item.x, clothingDetails.value.grid.x + clothingDetails.value.grid.w - item.w));
  item.y = Math.max(clothingDetails.value.grid.y, Math.min(item.y, clothingDetails.value.grid.y + clothingDetails.value.grid.h - item.h));

  draw();
}

function stopDrag() {
  mouseDown.value = false;
  draggingIndex = -1;
  resizeHandleIndex = -1;
  resizingImageIndex = -1;
  resizeGuideHandle = -1;
  draggingGuide = false;
}

function openFileDialog() {
  fileInput.value?.click();
}

function updateClothing(details: any) {
  if (!details || !details.grid) return;
  clothingDetails.value = details;
  if (details.image) {
    shirtBg.onload = () => {
      shirtBgLoaded.value = true;
      draw();
    };
    shirtBg.src = details.image;
  }
  // Update grid limits by reference
  // (the draw function always uses clothingDetails.value.grid)
  // Clear placed images
  images.splice(0, images.length);
  draw();
}

defineExpose({ openFileDialog, updateClothing });
</script>

<style scoped>
.lab-container {
    left: 45%;

}
</style>