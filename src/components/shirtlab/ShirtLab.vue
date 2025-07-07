<template>
    <SideMenu @imageSelected="onImageSelected" />
    <CanvasArea>
      <ThreeViewport ref="viewport" />
    </CanvasArea>
</template>

<script setup lang="ts">
    import { ref } from 'vue';
    import CanvasArea from '../canvasArea/CanvasArea.vue';
    import SideMenu from '../sideMenu/SideMenu.vue'
    import ThreeViewport from '../canvasArea/ThreeViewport.vue'

    // Reference to the ThreeViewport component
    const viewport = ref<InstanceType<typeof ThreeViewport> | null>(null);

    // Handler for when SideMenu emits a File to upload
    function onImageSelected(file: File) {
      if (!viewport.value) return;
      const fakeEvent = {
        target: { files: [file] }
      } as unknown as Event;
      viewport.value.onFileChange(fakeEvent);
    }
</script>

<style scoped></style>