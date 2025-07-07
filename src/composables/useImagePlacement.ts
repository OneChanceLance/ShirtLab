// src/composables/useImagePlacement.ts
import { ref, onUnmounted } from 'vue';
import * as THREE from 'three';
import { MeshBasicMaterial, PlaneGeometry, Mesh, Texture } from 'three';
// @ts-ignore
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { useAnimation } from './useAnimation';

export function useImagePlacement(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  controls: any,              // your orbit/trackball controls instance
  dynamicTexture: THREE.CanvasTexture
) {
  // store your decals
  const decals = ref<THREE.Mesh[]>([]);

  // setup TransformControls
  const transform = new TransformControls(camera as THREE.PerspectiveCamera, renderer.domElement);
  scene.add(transform);

  // Raycaster for pointer interactions
  const raycaster = new THREE.Raycaster();

  // allow orbit controls to be disabled while dragging
  transform.addEventListener('dragging-changed', (e) => {
    controls.enabled = !e.value;
  });

  // animate so controls stay in sync
  useAnimation(() => {
    transform.updateMatrixWorld();
  }, renderer, scene, camera);

  // add a decal at the center of the shirt
  function addDecal(imageUrl: string) {
    // Create a yellow placeholder square
    const placeholderMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), placeholderMat);
    // Position at front of shirt (adjust as needed)
    plane.position.set(0, 0.5, 0);
    scene.add(plane);
    decals.value.push(plane);
    transform.attach(plane);

    // Load the actual image and swap the material
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const decalTex = new THREE.Texture(img);
      decalTex.needsUpdate = true;
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.map = decalTex;
      mat.color.set(0xffffff);
      mat.opacity = 1;
      mat.transparent = true;
      mat.needsUpdate = true;
    };
  }

  // detach controls when clicking outside
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(decals.value, true);

    if (hit.length) {
      transform.attach(hit[0].object as THREE.Object3D);
    } else {
      transform.detach();
    }
  });

  onUnmounted(() => {
    scene.remove(transform);
    renderer.domElement.removeEventListener('pointerdown', () => {});
  });

  return {
    decals,
    addDecal,
    transformControls: transform,
  };
}