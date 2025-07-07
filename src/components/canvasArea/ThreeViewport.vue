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
baseImage.src = '/models/textures/UVMAP_diffuse_1001.png'
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
let placed = false;
let isHovering = false;
const hoverThreshold = 0.1; // adjust radius in UV space

// Raycasting and mouse setup for placing images on the shirt
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let shirtModel: THREE.Object3D | null = null
let currentUV = new THREE.Vector2();

function updateDecal(hover: boolean) {
  decalCtx.clearRect(0, 0, canvasSize, canvasSize);
  decalCtx.drawImage(baseImage, 0, 0, canvasSize, canvasSize);
  decalCtx.filter = hover ? 'brightness(200%)' : 'none';
  const logoSize = canvasSize * 0.1;
  decalCtx.drawImage(
    logoImg,
    currentUV.x * canvasSize - logoSize / 2,
    (1 - currentUV.y) * canvasSize - logoSize / 2,
    logoSize,
    logoSize
  );
  decalCtx.filter = 'none';
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
  const textureLoader = new THREE.TextureLoader().setPath('/models/textures/')

  // Load logo decal from /models/logo.png
  // Not needed: decalMaterial, decalMesh

  
  const mtlLoader = new MTLLoader()
  mtlLoader.setPath('/models/');
  mtlLoader.setResourcePath('/models/textures/');
  mtlLoader.load('OBJ_1.mtl', (materials) => {
    materials.preload()

    const objLoader = new OBJLoader()
    objLoader.setMaterials(materials)
    objLoader.setPath('/models/')
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

const controls = new OrbitControls(camera, renderer.domElement)
// Disable damping/inertia so rotation stops instantly when you let go:
controls.enableDamping = false
controls.dampingFactor = 0.05
controls.enableRotate = true


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
    return;
  }

  // Click WAS on the shirt
  if (placed) {
    // Only unlock if hovering over the decal
    if (isHovering) {
      placed = false;
      updateDecal(false);
    }
    return;
  }

  placed = true;
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
    if (!hits.length || !hits[0].uv) {
      if (isHovering) {
        isHovering = false;
        updateDecal(false);
      }
      return;
    }
    const uvHit = hits[0].uv.clone();
    uvHit.x = clampUV(uvHit.x, chestBounds.xMin, chestBounds.xMax);
    uvHit.y = clampUV(uvHit.y, chestBounds.yMin, chestBounds.yMax);
    const dist = uvHit.distanceTo(currentUV);
    const hoveringNow = dist < hoverThreshold;
    if (hoveringNow !== isHovering) {
      isHovering = hoveringNow;
      if (isHovering) console.log('Hovering over decal');
      updateDecal(isHovering);
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
</style>
