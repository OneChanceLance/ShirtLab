<template>
  <div class="weight-slider">
    <div class="track-wrap" @click.stop>
      <input
        type="range"
        class="slider"
        v-model="inner"
        :min="min"
        :max="max"
        :step="step"
        :style="{ '--pct': pct + '%' }"
        @input="emitUpdate"
        list="steplist"
      />
      <datalist id="steplist">
        <option
          v-for="n in max - min + 1"
          :key="n"
          :value="min + (n - 1) * step"
        />
      </datalist>
      <div class="ticks">
        <span v-for="n in max - min + 1" :key="n" class="tick"></span>
      </div>
      <div
        class="fake-slider"
        :style="{ backgroundSize: pct + '% 100%' }"
      ></div>
    </div>

    <div v-if="showLabels" class="labels">
      <span class="left">{{ props.leftLabel }}</span>
      <span class="right">{{ props.rightLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, withDefaults } from "vue";

type Props = {
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  showLabels?: boolean;
  leftLabel?: string;
  rightLabel?: string;
};
const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 6,
  step: 1,
  showLabels: true,
  leftLabel: "Very Light",
  rightLabel: "Very Heavy",
});
const emit = defineEmits<{ (e: "update:modelValue", v: number): void }>();

const showLabels = computed(() => props.showLabels);

const inner = computed({
  get: () => props.modelValue,
  set: (v: number) => emit("update:modelValue", v),
});

const pct = computed(() => {
  const span = props.max - props.min;
  if (span <= 0) return 0;
  return ((inner.value - props.min) / span) * 100;
});

function emitUpdate() {
  emit("update:modelValue", Number(inner.value));
}
</script>

<style scoped>
.weight-slider {
  --accent: rgb(164, 199, 77);
  --accent-weak: #dfe8cf;
  width: 100;
}

/* container for track & ticks */
.track-wrap {
  position: relative;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;

  /* room for thumb */
}

/* the bar + progress */
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 97.5%;
  height: 5px;
  border-radius: 999px;
  outline: none;
  margin: 0;
  position: relative;
  background: transparent;
  /* background handled by .fake-slider */
  z-index: 5;
}

.fake-slider {
  position: absolute;
  left: 5%;
  width: 90%;
  top: 55%;
  transform: translateY(-50%);
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(var(--accent), var(--accent)) no-repeat,
    var(--accent-weak);
  background-size: 0% 100%, 100% 100%;
  z-index: 1;
  pointer-events: none;
}

/* webkit thumb */
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--accent);
  z-index: 4;

  /* clean edge on green */
  cursor: pointer;

  /* centers thumb over 8px track */
}

/* firefox track & thumb */
.slider::-moz-range-track {
  height: 8px;
  border-radius: 999px;
  background: transparent;
  margin: 0 auto;

  /* we render with background on input */
}

.slider::-moz-range-progress {
  height: 4px;
  border-radius: 999px 0 0 999px;
}

.slider::-moz-range-thumb {
  display: flex;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  cursor: pointer;
  z-index: 110;
  justify-content: center;
}

/* ticks (little green dots) */
.ticks {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: absolute;
  left: 3.25%;
  width: 93.5%;

  top: 55%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 3;
}

.tick {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  border: 1.5px solid white;
}

/* labels */
.labels {
  display: flex;
  justify-content: space-between;

  margin: 0;
  font-family: "Anek Latin", system-ui, sans-serif;
  color: #111;
  font-size: 0.95rem;
  line-height: 1.05rem;
}

.labels .left,
.labels .right {
  display: inline-flex;
  flex-direction: column;
  font-size: 0.75rem;
  font-weight: 400;
  color: #2f3640;
  letter-spacing: 0.05em;
}
</style>
