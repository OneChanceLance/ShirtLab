<template>
  <div class="canvas-wrapper">
    <div class="background-frame">
        <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
    
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  max-width: 1200px;
  background: linear-gradient(to bottom right, #e0e0e0, #ffffff);
}

.background-frame {
  width: 90%;
  max-width: 1200px;
  height: 90%;
  background-color: #fdfdfd;
  border: 1px solid #ccc;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  position: relative;
}
</style>