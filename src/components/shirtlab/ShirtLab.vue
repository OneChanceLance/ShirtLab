<template>
  <SideMenu :selected-text="selectedText" :draw="draw" @uploadObject="handleUploadObject"
    @selectClothing="handleClothingSelect" @center-text="shirtPlacerRef.centerSelectedText()"
    @duplicate-text="shirtPlacerRef?.duplicateSelectedText && shirtPlacerRef.duplicateSelectedText()"
    @bring-forward="shirtPlacerRef?.bringSelectedForward && shirtPlacerRef.bringSelectedForward()"
    @send-back="shirtPlacerRef?.sendSelectedBack && shirtPlacerRef.sendSelectedBack()" />
  <CanvasArea>
    <ShirtPlacer ref="shirtPlacerRef" />
  </CanvasArea>
</template>

<script setup lang="ts">
  import { ref, computed, type Ref } from 'vue';
  import type { TextObject } from './types';
  import CanvasArea from '../canvasArea/CanvasArea.vue';
  import SideMenu from '../sideMenu/SideMenu.vue';
  import ShirtPlacer from './ShirtPlacer.vue';


  const shirtPlacerRef = ref();

  const selectedText = computed<TextObject | null>(() => {
    return (shirtPlacerRef.value as any)?.selectedObject ?? null;
  });

  function draw() {
    shirtPlacerRef.value?.draw();
  }

  function centerSelectedText() {
    shirtPlacerRef.value?.centerSelectedText();
  }

  function openFileDialogFromMenu() {
    shirtPlacerRef.value?.openFileDialog();
  }

  function handleClothingSelect(details: any) {
    shirtPlacerRef.value?.updateClothing(details);
  }

  function handleUploadObject(type: string, payload: any) {
    console.trace()
    console.log(type, payload)
    shirtPlacerRef.value?.uploadObject(type, payload);
  }
</script>