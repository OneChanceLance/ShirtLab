<template>
  <h3>BORDER</h3>
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
    border-radius: 2rem;
    height: 50rem;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border: 3px dashed rgba(138, 12, 12, 0.765) ;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  h3 {
    margin-top: 5rem;
    color: rgba(111, 12, 12, 0.765);
    font-weight: 500;
  }

</style>
