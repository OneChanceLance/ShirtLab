<template>
  <div class="style-container">
    <p class="label">Font</p>
    <div class="font-display">
      <span class="font-name">Casey Classic</span>
      <span class="arrow">›</span>
    </div>
  </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue';

    const tabOpened = ref(true)

</script>

<style scoped>
.style-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  font-family: sans-serif;
}

.label {
  font-size: 14px;
  font-weight: 500;
}

.font-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.font-name {
  font-family: 'Casey Classic';
  font-size: 20px;
}

.arrow {
  font-size: 20px;
  color: #555;
}
</style>