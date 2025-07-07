<template>
  <div class="progressBar">
    <template v-for="(label, index) in steps" :key="index">
      <div class="step">
        <CircleMark :label="label" :active="activeIndex >= index" />
      </div>
      <div
        v-if="index < steps.length - 1"
        class="line"
      ></div>
    </template>
  </div>
  <div class="buttons">
    <button @click="backStep" class="back-button">Back</button>
    <button @click="nextStep" class="next-button">Next Step</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CircleMark from './CircleMark.vue'

const steps = [
  'Clothing Type',
  'more design',
  'oh no the printer broke',
]

const activeIndex = ref(0)
const queuedIndex = ref(0)

function nextStep() {
  if (queuedIndex.value < steps.length) {
    queuedIndex.value++
    setTimeout(() => {
      activeIndex.value = queuedIndex.value
    }, 1000)
  }
}

function backStep() {
  if (queuedIndex.value > 0) {
    queuedIndex.value--
    activeIndex.value = queuedIndex.value
  }
}
</script>

<style scoped>
.progressBar {
  width: 100%;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;

}

.line {
  height: 4px;
  width: 120px;
  background: linear-gradient(145deg, rgba(0, 255, 128, 0.35) 0%, rgba(0, 255, 128, 0.15) 100%),
              radial-gradient(circle at 30% 30%, #baffd0 0%, rgba(0, 255, 128, 0.1) 70%);
  border-radius: 2px;
  box-shadow: 0 2px 8px 0 rgba(0, 255, 128, 0.25), 0 0 16px 2px rgba(0, 255, 128, 0.15) inset;
  position: relative;
  overflow: hidden
}

.line::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  background-color: #94C940;
  animation: fillLine 1s forwards;
}

@keyframes fillLine {
  0% {
    width: 0%;
  }
  100% {
    width: 100%;
  }
}

@keyframes fillLineReverse {
  0% {
    width: 100%;
  }
  100% {
    width: 0%;
  }
}

.next-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  background-color: #00c853;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.next-button:hover {
  background-color: #00b84d;
}

.buttons {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.back-button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  background-color: #ccc;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: #bbb;
}
</style>