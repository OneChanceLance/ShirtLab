// src/utils/modelLoader.ts
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

export async function loadModel(modelName: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const basePath = `/models/${modelName}/`;
    const objPath = `${basePath}OBJ_1.obj`;
    const mtlPath = `${basePath}OBJ_1.mtl`;
    const textureBase = `${basePath}textures/`;

    const manager = new THREE.LoadingManager();
    const mtlLoader = new MTLLoader(manager);
    const objLoader = new OBJLoader(manager);

    mtlLoader.load(mtlPath, (materials) => {
      materials.preload();
      objLoader.setMaterials(materials);

      objLoader.load(
        objPath,
        (object) => {
          object.traverse((child: any) => {
            if (child.isMesh) {
              const material = child.material as THREE.MeshStandardMaterial;
              const loader = new THREE.TextureLoader();

              material.map = loader.load(`${textureBase}UVMAP_diffuse_.png`);
              material.normalMap = loader.load(`${textureBase}UVMAP_normal_.png`);
              material.roughnessMap = loader.load(`${textureBase}UVMAP_roughness_.png`);
              material.metalnessMap = loader.load(`${textureBase}UVMAP_metalness_.png`);
              material.alphaMap = loader.load(`${textureBase}UVMAP_opacity_.png`);
              material.transparent = true;

              material.needsUpdate = true;
            }
          });

          resolve(object);
        },
        undefined,
        (error) => reject(error)
      );
    });
  });
}