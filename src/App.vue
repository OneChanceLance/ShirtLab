<template>
  <div class="app-shell">
    <div class="app-shell__workspace">
      <div class="embed-container">
        <ShirtLab ref="shirtLabRef" />
      </div>
    </div>
    <SsActivewearMenu class="ssa-floating-menu" @variant-selected="handleVariantSelected" />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import ShirtLab from './components/shirtlab/ShirtLab.vue';
  import SsActivewearMenu from './components/SsActivewearMenu.vue';

  const shirtLabRef = ref<{ applyExternalClothing: (payload: any) => void } | null>(null);

  function handleVariantSelected(payload: any) {
    if (!shirtLabRef.value) return;
    const imagery = payload?.imagery ?? {};

    shirtLabRef.value.applyExternalClothing({
      front: imagery.front,
      back: imagery.back,
      grid: imagery.grid,
      colors: imagery.colors,
      bgTransform: imagery.bgTransform,
    });
  }
</script>

<style scoped>


  .app-shell {
    position: relative;
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  }

  .app-shell__workspace {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 3rem;
    box-sizing: border-box;
  }

  .embed-container {
    width: 1440px;
    max-width: 95vw;
    background-color: aliceblue;
    height: 560px;
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
  }

  .ssa-floating-menu {
    position: fixed;
    top: 1.5rem;
    left: calc(13.5rem + 2rem);
    z-index: 3000;
  }
</style>
