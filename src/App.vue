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
    width: 90rem;
    border-radius: 15px;
    height: 50rem;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border: 1px solid gray;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }

</style>
