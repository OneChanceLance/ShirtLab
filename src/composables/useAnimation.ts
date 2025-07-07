import * as THREE from 'three'

export function useAnimation(
  onFrame: () => void,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
) {
  function animate() {
    requestAnimationFrame(animate)
    onFrame()
    renderer.render(scene, camera)
  }
  animate()
}