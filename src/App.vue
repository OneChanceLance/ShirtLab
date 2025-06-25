<template>
  <div class="embed-container">
    <ShirtLab />
  </div>
</template>

<script setup lang="ts">
  import ShirtLab from './components/shirtlab/ShirtLab.vue'
</script>

<style scoped>

  .embed-container {
    width: 800px;
    height: 600px;
    border: 1px solid gray;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }

</style>
