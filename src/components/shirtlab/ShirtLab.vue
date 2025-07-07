<template>
  <SideMenu
    @triggerDesignUpload="openFileDialogFromMenu"
    @selectClothing="handleClothingSelect"
  />
  <CanvasArea>

    <ShirtPlacer ref="shirtPlacerRef" />
  </CanvasArea>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import CanvasArea from '../canvasArea/CanvasArea.vue';
  import SideMenu from '../sideMenu/SideMenu.vue'
  import ShirtPlacer from '../../ShirtPlacement/ShirtPlacer.vue';
  const shirtPlacerRef = ref();
  function openFileDialogFromMenu() {
    shirtPlacerRef.value?.openFileDialog();
  }
  function handleClothingSelect(details: any) {
    shirtPlacerRef.value?.updateClothing(details);
  }

</script>

<style scoped>
</style>