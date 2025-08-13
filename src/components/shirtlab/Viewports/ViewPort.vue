<template>
    <div class="container" @click="model = label" :key="label">
        <div class="viewport">
            <img />
        </div>
        <div :class="['activeLine', { active: model === label }]"></div>
        <span>{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
    defineProps({
        label: String
    })

    const model = defineModel<string>()
</script>

<style scoped lang="scss">

    .container {
        :hover {
            cursor: pointer;
        }
    }

    .viewport {
        background-color: rgb(75, 85, 93);
        border-radius: 0.5rem;
        width: 5rem;
        height: 5rem;
        margin: 0 auto;
        margin-bottom: -0.15rem;

    }

    .activeLine {
        background: transparent;
        margin: 5px auto;
        width: 5rem;
        height: 0.1rem;
        margin-bottom: -0.25rem;

        &.active {
            background-color: rgb(75, 85, 93);

        }
    }




    span {
        margin: 0 1px;
        font-family: 'Anek Latin';
        font-size: 0.75rem;
        font-weight: 300;
    }

</style>
