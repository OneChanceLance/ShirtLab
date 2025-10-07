<template>
    <div class="tab-picker">
        <button v-for="item in options" :key="String(item[valueKey])"
            :class="['tab-btn', { active: isActive(item[valueKey]), small: size === 'small' }]"
            @click="pick(item[valueKey])">
            <!-- LEFT -->
            <svg v-if="item[valueKey] === 'left'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="icon">
                <rect x="0" y="8" width="50" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
                <rect x="0" y="15" width="16" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
                <rect x="0" y="22" width="50" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
            </svg>

            <!-- CENTER -->
            <svg v-else-if="item[valueKey] === 'center'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"
                class="icon">
                <rect x="0" y="8" width="50" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
                <rect x="8" y="15" width="16" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
                <rect x="0" y="22" width="50" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
            </svg>

            <!-- RIGHT -->
            <svg v-else-if="item[valueKey] === 'right'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"
                class="icon">
                <rect x="0" y="8" width="50" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
                <rect x="16" y="15" width="20" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
                <rect x="0" y="22" width="50" height="2"
                    :fill="isActive(item[valueKey]) ? 'white' : 'rgb(107,112,120)'" />
            </svg>
        </button>
    </div>
</template>

<script setup lang="ts">
    type Align = 'left' | 'center' | 'right';
    type TabOption = Record<string, Align>;

    withDefaults(defineProps<{
        options: TabOption[];
        valueKey: string;
        size?: 'default' | 'small';
    }>(), {
        size: 'default'
    });

    // v-model for this component
    const model = defineModel<Align>({ default: 'left' });

    // helpers so the template stays dumb
    const isActive = (val: string) => model.value === (val as Align);
    const pick = (val: string) => { model.value = val as Align; };
</script>

<style scoped lang="scss">
    .tab-picker {
        display: flex;
        overflow-x: auto;
        border-radius: 7.5px;
        scrollbar-width: none;
        margin: auto;
        border: 1px solid rgb(107, 112, 120);

        &:active {
            transform: scale(0.95);
            animation: bounce 1s ease;
        }
    }

    .tab-btn {
        flex: 1;
        background: transparent;
        color: #fff;
        padding: 0.25rem 1.1rem;
        font-size: 1rem;
        transition: 0.2s;
        text-transform: uppercase;
        font-weight: 500;
        cursor: pointer;
        border-radius: 0;

        &.active {
            background: rgb(107, 112, 120);
            color: rgb(30, 30, 30);
        }
    }

    .tab-btn.small {
        font-size: 0.75rem;
        padding: 0.2rem 1rem;
    }

    .tab-btn .icon {
        height: 1.5rem;
        width: auto;
        display: block;
        margin: auto;
    }
</style>
