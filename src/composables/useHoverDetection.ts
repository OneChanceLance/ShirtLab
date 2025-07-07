import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useAnimation } from './useAnimation';

/**
 * Continuously detects hover state over shirt, decals, or outside.
 * @param scene - THREE.Scene containing the shirt and decals
 * @param camera - THREE.Camera used for raycasting
 * @param renderer - THREE.WebGLRenderer instance
 * @param shirtModel - Root Object3D of the shirt mesh
 * @returns A ref<'shirt' | 'decal' | 'outside'> updating on hover
 */
export function useHoverDetection(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  shirtModel: THREE.Object3D
) {
  const domElement = renderer.domElement;
  const hoverMode = ref<'shirt' | 'decal' | 'outside'>('outside');
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Update normalized pointer coordinates
  const onPointerMove = (event: MouseEvent) => {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  // Raycast each frame to detect hovered object
  const detectHover = () => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(shirtModel, true);
    if (hits.length) {
      hoverMode.value = 'shirt';
    } else {
      hoverMode.value = 'outside';
    }
  };

  // start detecting hover right away
  domElement.addEventListener('pointermove', onPointerMove);
  useAnimation(detectHover, renderer, scene, camera);

  onUnmounted(() => {
    domElement.removeEventListener('pointermove', onPointerMove);
  });

  return hoverMode;
}