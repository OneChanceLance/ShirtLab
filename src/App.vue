<template>
  <h3>BORDER</h3>
  <div v-if="!componentsShowing" class="embed-container">
    <ShirtLab />
  </div>
  <div v-else class="embed-container">
    <h3>Components are showing</h3>
  </div>height: 598 px width: 1536 px
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import ShirtLab from './components/shirtlab/ShirtLab.vue'

  const componentsShowing = ref(false);
</script>

<style scoped>

  .embed-container {
    width: 1440px;
    /* keep it wide for workspace */
    background-color: aliceblue;
    height: 560px;
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transform-origin: center;
  }

  #buttons {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  h3 {
    margin-top: 4.5%;
    color: rgba(128, 128, 128, 0.765);
    font-weight: 500;
  }

  button {
    z-index: 10;
    margin-top: 5rem;
    color: rgba(111, 12, 12, 0.765);
    font-weight: 500;
  }

</style>
