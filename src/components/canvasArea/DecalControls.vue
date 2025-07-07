
<template>
  <!-- DecalControls has no visual markup; it manages the decal canvas -->
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import * as THREE from 'three'

interface Props {
  container: HTMLDivElement
  camera: THREE.PerspectiveCamera
  shirtModel: THREE.Object3D
  decalCanvas: HTMLCanvasElement
}

const props = defineProps<Props>()

// Raycasting and mouse
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// State
let placed = false
let currentUV = new THREE.Vector2()

// Canvas & texture
const decalCtx = props.decalCanvas.getContext('2d')!
const dynamicTexture = new THREE.CanvasTexture(props.decalCanvas)

// Load images
const baseImage = new Image()
baseImage.src = '/models/textures/UVMAP_diffuse_1001.png'
const logoImg = new Image()
logoImg.src = '/logo.png'

const handleMouseMove = (event: MouseEvent) => {
  if (placed) return
  const rect = props.container.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, props.camera)
  const hits = raycaster.intersectObject(props.shirtModel, true)
  if (hits.length && hits[0].uv) {
    const uv = hits[0].uv!
    currentUV.copy(uv)
    // redraw canvas
    const size = props.decalCanvas.width
    decalCtx.clearRect(0, 0, size, size)
    decalCtx.drawImage(baseImage, 0, 0, size, size)
    const logoSize = size * 0.1
    decalCtx.drawImage(
      logoImg,
      uv.x * size - logoSize / 2,
      (1 - uv.y) * size - logoSize / 2,
      logoSize,
      logoSize
    )
    dynamicTexture.needsUpdate = true
  }
}

const handleClick = () => {
  placed = true
}

onMounted(async () => {
  await Promise.all([
    new Promise(res => (baseImage.onload = res)),
    new Promise(res => (logoImg.onload = res)),
  ])
  props.container.addEventListener('mousemove', handleMouseMove)
  props.container.addEventListener('click', handleClick)
})
</script>