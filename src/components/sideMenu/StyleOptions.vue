<template>
    <div class="buttons-container">
        <p class="label">{{ label }}</p>
        <div class="buttons-list">
            <button v-for="item in options" :key="typeof item === 'string' ? item : item[valueKey]" :class="[
                'btn',
                {
                    active: props.multiple
                        ? safeSelectedItems.includes(typeof item === 'string' ? item : item[valueKey])
                        : model === (typeof item === 'string' ? item : item[valueKey])
                }
            ]" @click="
                props.multiple
                    ? toggleItem(typeof item === 'string' ? item : item[valueKey])
                    : model = typeof item === 'string' ? item : item[valueKey]
                ">
                {{ typeof item === 'string' ? item : item[displayKey] }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { defineProps, defineModel, ref, computed } from 'vue';

    interface Props {
        label: string;
        options: (string | Record<string, any>)[];
        valueKey?: string;
        displayKey?: string;
        multiple?: boolean;
    }

    const props = defineProps<Props>();

    const valueKey = props.valueKey ?? 'self';
    const displayKey = props.displayKey ?? 'self';

    const model = defineModel<string | string[]>();

    const selectedItems = ref<string[]>([]);

    const safeSelectedItems = computed(() => props.multiple ? selectedItems.value : []);

    function toggleItem(value: string) {
        const index = selectedItems.value.indexOf(value);
        if (index === -1) {
            selectedItems.value.push(value);
        } else {
            selectedItems.value.splice(index, 1);
        }
        model.value = selectedItems.value.join(','); // or emit array if your model expects it
    }
</script>

<style scoped>
    .buttons-container {
        background-color: rgb(46, 46, 46);
        border: 1px dashed grey;
        padding: 0.5rem;
        margin: 1 auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        font-family: Verdana, Geneva, Tahoma, sans-serif;
    }

    .label {

        font-weight: 500;
        min-width: 50px;

        margin: 0 auto;
    }

    .buttons-list {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: center;
    }

    .btn {
        width: 6rem;
        background: rgb(34, 34, 34);
        border: none;
        color: #fff;
        border-radius: 0.5rem;
        padding: 0.25rem 0.9rem;
        font-size: 1rem;
        cursor: pointer;
        transition: 0.2s;
        text-transform: capitalize;
    }

    .btn:hover {
        background: rgb(234, 234, 234);
        color: rgb(5, 5, 5);
    }

    .btn.active {
        background: rgb(134, 242, 145);
        box-shadow: 0rem 0rem 0.2rem 0.1rem rgb(134, 242, 145);
        color: rgb(51, 51, 51);
    }


</style>