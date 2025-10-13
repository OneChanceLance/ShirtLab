import { reactive, ref } from 'vue';
import type { ImageObject, TextObject } from '../types';

export type PlacedObject = ImageObject | TextObject;

export function useDesignLayers() {
  const images = reactive<ImageObject[]>([]);
  const texts = reactive<TextObject[]>([]);
  const selectedObject = ref<PlacedObject | null>(null);
  const zCounter = ref(1);

  function getAllObjectsByZ() {
    const ordered = [...images, ...texts] as PlacedObject[];
    ordered.sort((a, b) => (Number(a.z ?? 0) - Number(b.z ?? 0)));
    return ordered;
  }

  function rebalanceZ() {
    const ordered = getAllObjectsByZ();
    ordered.forEach((item, index) => {
      item.z = index + 1;
    });
    zCounter.value = ordered.length + 1;
  }

  function getZExtrema() {
    const ordered = [...images, ...texts] as PlacedObject[];
    let minZ = Infinity;
    let maxZ = -Infinity;
    ordered.forEach((obj) => {
      const z = Number(obj.z ?? 0);
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
    if (!Number.isFinite(minZ)) minZ = 0;
    if (!Number.isFinite(maxZ)) maxZ = 0;
    return { minZ, maxZ };
  }

  function deselectAll() {
    images.forEach((image) => (image.isSelected = false));
    texts.forEach((text) => (text.isSelected = false));
    selectedObject.value = null;
  }

  return {
    images,
    texts,
    selectedObject,
    zCounter,
    getAllObjectsByZ,
    rebalanceZ,
    getZExtrema,
    deselectAll,
  };
}
