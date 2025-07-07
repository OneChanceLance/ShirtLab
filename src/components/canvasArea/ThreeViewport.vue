<template>
  <input 
    type="file" 
    accept="image/*" 
    @change="onFileChange" 
    style="position:absolute; top:10px; left:10px; z-index:10;"
  />
  <div ref="canvasContainer" class="canvas-container"></div>
  <div class="camera-coords">
    Camera: X: {{ cameraPosition.x.toFixed(2) }}, 
    Y: {{ cameraPosition.y.toFixed(2) }}, 
    Z: {{ cameraPosition.z.toFixed(2) }}
  </div>
  <div class="hover-indicator">
    Hovering: {{ hoveredState }}
  </div>
  
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import * as THREE from 'three'
import { Sprite, SpriteMaterial } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { handleImageUploadEvent } from '../../utils/imageUpload'

function onFileChange(e: Event) {
  const url = handleImageUploadEvent(e);
  if (url) {
    logoImg.src = url;
  }
}

defineExpose({ onFileChange });
// Track whether the decal is currently selected
const decalSelected = ref(false);
const canvasContainer = ref<HTMLDivElement | null>(null)
const cameraPosition = reactive({ x: 0, y: 0, z: 0 })

const handleDefaultColor = new THREE.Color(0xffffff)
const handleHoverColor = new THREE.Color(0xffff00)
const decalDefaultOpacity = 1.0

const decalHoverOpacity = 0.8

// Chest area bounds in UV space
const chestBounds = { xMin: 0.27, xMax: 0.35, yMin: 0.2, yMax: 0.45 };
// Clamp a value between min and max
const clampUV = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Decal canvas setup
const decalCanvas = document.createElement('canvas')
const canvasSize = 1024
decalCanvas.width = canvasSize
decalCanvas.height = canvasSize
const decalCtx = decalCanvas.getContext('2d')!
const baseImage = new Image()
baseImage.src = '/models/tshirtFemale/textures/UVMAP_diffuse_1001.png'
baseImage.onload = () => {
  decalCtx.drawImage(baseImage, 0, 0, canvasSize, canvasSize)
  dynamicTexture.needsUpdate = true
}
const logoImg = new Image()
logoImg.src = '/logo.png'
const dynamicTexture = new THREE.CanvasTexture(decalCanvas)
dynamicTexture.flipY = true
dynamicTexture.encoding = THREE.SRGBColorSpace

let isDraggingDecal = false
// Resizing state
let decalScale = new THREE.Vector2(1, 1);
let isResizing = false;
let resizeSign = { x: 1, y: 1 };
let initialScale = new THREE.Vector2(1, 1);
let initialHalfWidthUV = 0.05;
// Prevent texture wrapping and lock aspect ratio
dynamicTexture.wrapS = THREE.ClampToEdgeWrapping;
dynamicTexture.wrapT = THREE.ClampToEdgeWrapping;
let initialAspectRatio = 1;
const cornerThresholdUV = 0.02;

let placed = false;
let isHovering = false;

// Hover indicator state
const hoveredState = ref<'outside' | 'shirt' | 'decal'>('outside');


// Raycasting and mouse setup for placing images on the shirt
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let shirtModel: THREE.Object3D | null = null
let currentUV = new THREE.Vector2();

function updateDecal(_: boolean) {
    const shouldHighlight = isHovering || isResizing || decalSelected.value;
  decalCtx.clearRect(0, 0, canvasSize, canvasSize);
  decalCtx.drawImage(baseImage, 0, 0, canvasSize, canvasSize);

  const baseLogoSize = canvasSize * 0.1;
  const width = baseLogoSize * decalScale.x;
  const height = baseLogoSize * decalScale.y;
  const x = currentUV.x * canvasSize - width / 2;
  const y = (1 - currentUV.y) * canvasSize - height / 2;

if (shouldHighlight) {
    // draw semi-transparent white background
    decalCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    decalCtx.fillRect(x, y, width, height);
  }

decalCtx.filter = (isHovering || isResizing) ? 'brightness(200%)' : 'none';
  decalCtx.drawImage(logoImg, x, y, width, height);
  decalCtx.filter = 'none';

  // draw resize handles
  const handleSize = 10;
  const halfHandle = handleSize / 2;
  decalCtx.fillStyle = 'white';
  decalCtx.strokeStyle = 'black';
  const corners = [
    { sx: 0, sy: 0 },
    { sx: 1, sy: 0 },
    { sx: 0, sy: 1 },
    { sx: 1, sy: 1 },
  ];
  corners.forEach(({ sx, sy }) => {
    const hx = x + sx * width - halfHandle;
    const hy = y + sy * height - halfHandle;
    decalCtx.fillRect(hx, hy, handleSize, handleSize);
    decalCtx.strokeRect(hx, hy, handleSize, handleSize);
  });

  dynamicTexture.needsUpdate = true;
}


onMounted(() => {
  if (!canvasContainer.value) return

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1,
    1000
  )
  // We'll set this later after object is loaded

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const canvasEl = renderer.domElement;
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  canvasContainer.value.appendChild(renderer.domElement)

  // Load all texture maps from the models/textures folder
  const textureLoader = new THREE.TextureLoader().setPath('/models/tshirtFemale/textures/')

  // Load logo decal from /models/logo.png
  // Not needed: decalMaterial, decalMesh

  
  const mtlLoader = new MTLLoader()
  mtlLoader.setPath('/models/tshirtFemale/');
  mtlLoader.setResourcePath('/models/tshirtFemale/textures/');
  mtlLoader.load('OBJ_1.mtl', (materials) => {
    materials.preload()

    const objLoader = new OBJLoader()
    objLoader.setMaterials(materials)
    objLoader.setPath('/models/tshirtFemale/')
    objLoader.load('OBJ_1.obj', (object) => {
      object.scale.set(2, 2, 2)
      // Center the object's origin to its geometry center
      const box = new THREE.Box3().setFromObject(object)
      const center = new THREE.Vector3()
      box.getCenter(center)
      object.position.sub(center)
      // Then position it in front of the camera
      const frontOfCamera = new THREE.Vector3(0, 0, 0).applyMatrix4(camera.matrixWorld)
      object.position.add(frontOfCamera)
      scene.add(object)

      // Set shirtModel for raycasting
      shirtModel = object

      // Apply dynamic canvas texture to every mesh
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          const mat = mesh.material
          const apply = (m: THREE.MeshStandardMaterial) => {
            m.map = dynamicTexture
            m.needsUpdate = true
          }
          if (Array.isArray(mat)) mat.forEach(m => apply(m))
          else if (mat instanceof THREE.MeshStandardMaterial) apply(mat)
        }
      })

      // Position the camera in front of the shirt
      camera.position.set(0, 0, 0.5)
      camera.lookAt(object.position)
    }, undefined, (error) => {
      console.error('Error loading OBJ:', error)
    })
  })

  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(5, 5, 5)
  scene.add(light)

  const ambient = new THREE.AmbientLight(0x404040)
  scene.add(ambient)

  // Back light for illuminating the back of the shirt
  const backLight = new THREE.DirectionalLight(0xffffff, 0.5)
  backLight.position.set(-5, 5, -5)
  scene.add(backLight)

const controls = new OrbitControls(camera, renderer.domElement)
// Disable damping/inertia so rotation stops instantly when you let go:
controls.enableDamping = false
controls.dampingFactor = 0.05
controls.enableRotate = true

// Start dragging decal when pointer down over decal or start resizing if near corner
canvasEl.addEventListener('pointerdown', (event: PointerEvent) => {
  if (placed && isHovering) {
    const bounds = canvasContainer.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(shirtModel!, true);
    if (hits.length && hits[0].uv) {
      const uvHit = hits[0].uv.clone();
      // Only start resizing if near a corner
      const halfW = initialHalfWidthUV * decalScale.x;
      const halfH = initialHalfWidthUV * decalScale.y; // Not used, but keep for symmetry
      const dx = uvHit.x - currentUV.x;
      const dy = uvHit.y - currentUV.y;
      const signX = dx > 0 ? 1 : -1;
      const signY = dy > 0 ? 1 : -1;
      if (Math.abs(Math.abs(dx) - halfW) < cornerThresholdUV &&
          Math.abs(Math.abs(dy) - halfH) < cornerThresholdUV) {
        // begin resizing
        isResizing = true;
        controls.enableRotate = false;
        initialScale.copy(decalScale);
        initialAspectRatio = initialScale.y / initialScale.x;
        resizeSign = { x: signX, y: signY };
        initialHalfWidthUV = halfW;
        return;
      }
    }
    // fallback to moving decal
    if (placed && isHovering) {
      isDraggingDecal = true;
      controls.enableRotate = false;
    }
  }
});

// Resize decal when dragging corner
canvasEl.addEventListener('pointermove', (event: PointerEvent) => {
  if (isResizing && shirtModel) {
    const bounds = canvasContainer.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(shirtModel, true);
    if (hits.length && hits[0].uv) {
      const uv = hits[0].uv.clone();
      // uniform scale based on horizontal drag distance
      const delta = (uv.x - currentUV.x) * resizeSign.x;
      const factor = delta / initialHalfWidthUV;
      const newScaleX = Math.max(0.1, initialScale.x * factor);
      const newScaleY = newScaleX * initialAspectRatio;
      decalScale.set(newScaleX, newScaleY);
      updateDecal(true);
    }
  }
});

// Drag decal: update position as pointer moves
canvasEl.addEventListener('pointermove', (event: PointerEvent) => {
  if (isDraggingDecal && shirtModel) {
    const bounds = canvasContainer.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(shirtModel, true);
    if (hits.length && hits[0].uv) {
      const uv = hits[0].uv.clone();
      uv.x = Math.max(chestBounds.xMin, Math.min(chestBounds.xMax, uv.x));
      uv.y = Math.max(chestBounds.yMin, Math.min(chestBounds.yMax, uv.y));
      currentUV.copy(uv);
      updateDecal(true);
    }
  }
});

// Stop dragging decal or resizing when pointer is released over the canvas
canvasEl.addEventListener('pointerup', () => {
  if (isResizing) {
    isResizing = false;
    controls.enableRotate = true;
  }
  if (isDraggingDecal) {
    isDraggingDecal = false;
    controls.enableRotate = true;
  }
});

  const animate = () => {
    requestAnimationFrame(animate)
    controls.update()


    renderer.render(scene, camera) 
    renderer.outputColorSpace = THREE.SRGBColorSpace

    cameraPosition.x = camera.position.x
    cameraPosition.y = camera.position.y
    cameraPosition.z = camera.position.z
  }

  animate()

  // Mouse event listeners for UV picking - streamlined to use canvas texture only
  const handleMouseDraw = (event: MouseEvent) => {
    if (placed) return
    const bounds = canvasContainer.value!.getBoundingClientRect()
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const hits = raycaster.intersectObject(shirtModel!, true)
    if (hits.length && hits[0].uv) {
      const uv = hits[0].uv!
      // Clamp into chest area bounds
      uv.x = clampUV(uv.x, chestBounds.xMin, chestBounds.xMax);
      uv.y = clampUV(uv.y, chestBounds.yMin, chestBounds.yMax);
      currentUV.copy(uv)
      // Clear and redraw base UV map
      decalCtx.clearRect(0, 0, canvasSize, canvasSize)
      decalCtx.drawImage(baseImage, 0, 0, canvasSize, canvasSize)
      // Draw logo at UV position
      const logoSize = canvasSize * 0.1
      decalCtx.drawImage(
        logoImg,
        uv.x * canvasSize - logoSize / 2,
        (1 - uv.y) * canvasSize - logoSize / 2,
        logoSize, logoSize
      )
      dynamicTexture.needsUpdate = true
    }
  }

  // Attach streamlined event: throttle mousemove to requestAnimationFrame
  let animationFrameId: number | null = null
  const throttledMouseMove = (event: MouseEvent) => {
    if (animationFrameId !== null) return
    animationFrameId = requestAnimationFrame(() => {
      handleMouseDraw(event)
      animationFrameId = null
    })
  }
  canvasEl.addEventListener('mousemove', throttledMouseMove)
  canvasEl.addEventListener('pointermove', throttledMouseMove)

  // On click, allow repositioning by clicking placed decal, or place if not placed
  canvasEl.addEventListener('click', (event: MouseEvent) => {
    if (!shirtModel) return;
    // Do a raycast to see if the click was on the shirt
    const bounds = canvasContainer.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(shirtModel, true);
    if (!hits.length || !hits[0].uv) {
      // Click was NOT on shirt—don't place decal!
      decalSelected.value = false;
      return;
    }

    if (!placed) {
      // first time placing
      placed = true;
      decalSelected.value = true;
      // … (your existing draw-at-currentUV code)
    } else {
      // toggle selection when clicking again; use dynamic hover threshold
      decalSelected.value = isHovering;
      updateDecal(false);  // refresh highlight
    }
    // Update decal placement at currentUV
    const uv = currentUV;
    uv.x = clampUV(uv.x, chestBounds.xMin, chestBounds.xMax);
    uv.y = clampUV(uv.y, chestBounds.yMin, chestBounds.yMax);
    decalCtx.drawImage(baseImage, 0, 0, canvasSize, canvasSize);
    const logoSize = canvasSize * 0.1;
    decalCtx.drawImage(
      logoImg,
      uv.x * canvasSize - logoSize / 2,
      (1 - uv.y) * canvasSize - logoSize / 2,
      logoSize, logoSize
    );
    dynamicTexture.needsUpdate = true;
  });

  // Hover highlight for placed decal using raycasting
  canvasEl.addEventListener('pointermove', (event: PointerEvent) => {
    if (!placed || isDraggingDecal || !shirtModel) return;
    const bounds = canvasContainer.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(shirtModel, true);
    let hoveringNow = false;
    if (hits.length && hits[0].uv) {
      const uvHit = hits[0].uv.clone();
      // Only consider UVs within the chest bounds
      if (
        uvHit.x >= chestBounds.xMin && uvHit.x <= chestBounds.xMax &&
        uvHit.y >= chestBounds.yMin && uvHit.y <= chestBounds.yMax
      ) {
        const dist = uvHit.distanceTo(currentUV);
        // Dynamic hover threshold = half the decal's UV width
        const dynamicThreshold = 0.05 * decalScale.x;
        hoveringNow = dist < dynamicThreshold;
      }
    }
    if (hoveringNow !== isHovering) {
      isHovering = hoveringNow;
      updateDecal(isHovering);
    }
  });

  // Update hover indicator for shirt, decal, or outside
  canvasEl.addEventListener('pointermove', (event: PointerEvent) => {
    if (!shirtModel) return;
    const bounds = canvasContainer.value!.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(shirtModel, true);
    if (!hits.length || !hits[0].uv) {
      hoveredState.value = 'outside';
    } else if (placed && isHovering) {
      hoveredState.value = 'decal';
    } else {
      hoveredState.value = 'shirt';
    }
  });

  // Optional: handle resizing
  window.addEventListener('resize', () => {
    if (!canvasContainer.value) return
    const width = canvasContainer.value.clientWidth
    const height = canvasContainer.value.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  })
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.camera-coords {
  position: absolute;
  bottom: 10px;
  left: 10px;
  color: white;
  background: rgba(0,0,0,0.6);
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}
.hover-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  color: white;
  background: rgba(0,0,0,0.6);
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}
</style>
