<template>
    <div>
        <input :class="['style-text']" v-model="model" :placeholder="name" />
    </div>
</template>

<script setup lang="ts">

defineProps({
    name: String
})

    const model = defineModel<string>({
        default: '',
        type: String,
    });

</script>

<style scoped>
    .style-text {
        background: rgba(255, 255, 255, 0.12);
        border: none;
        color: #fff;
        border-radius: 0.23rem;
        padding: 1rem unset;

        font-size: 1rem;
        transition: 0.2s;
        appearance: unset;
        outline: none;
        box-shadow: none;
        width: 100%;
    }
</style>