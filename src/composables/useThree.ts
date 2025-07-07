import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function useThree(container: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  
  renderer.setClearColor(0xf0f0f0, 1)
  container.appendChild(renderer.domElement)
  // Size renderer to its container
  renderer.setSize(container.clientWidth, container.clientHeight);
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.enableRotate = true
  camera.position.set(0, 0, 0.5)
  return { scene, camera, renderer, controls }
}