<template>

    <nav class="side-menu">
        <a href="https://seeourdesigns.com" target="_blank" rel="noopener" class="logo-row">
            <img class="logo" :src="logo" />

            <span class="brand-text"><strong>ShirtLab</strong> by SOD</span>
        </a>
        </hr>
        <MenuButton
          variant="Shirt"
          label="Clothing"
          :active="false"
          @click="triggerImageUpload"
        />
        <MenuButton variant="Design" label="Designs" :active="false" @click="() => emit('selectTool', 'Design')" />
        <MenuButton variant="Text" label="Text" :active="false" @click="() => emit('selectTool', 'Text')" />
        <input
          type="file"
          accept="image/*"
          ref="fileInput"
          @change="onFileChange"
          style="display: none;"
        />
    </nav>
</template>

<script setup lang="ts">
    import MenuButton from './MenuButton.vue';
    import logo from '../../assets/logo.png';
    import { ref } from 'vue'

    const emit = defineEmits<{
      (e: 'selectTool', tool: string): void,
      (e: 'imageSelected', file: File): void
    }>()

    const fileInput = ref<HTMLInputElement | null>(null)

    function triggerImageUpload() {
      // open file dialog
      fileInput.value?.click()
      // still inform parent of tool select
      emit('selectTool', 'Shirt')
    }

    function onFileChange(e: Event) {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        emit('imageSelected', file);
      }
    }
</script>

<style scoped>
    .side-menu {
      width: 10%;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      padding-top: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .title {
        color: #ffffff;
        font-weight: 00;
        text-transform: uppercase;

        padding: 5px;
    }

    .menu-item:hover {
        background-color: #928282;
    }

    .menu-item.active {
        background-color: #2a2a2a;
        border-left: 4px solid #94C940;
    }

    .logo {
        width: 45px;

    }

    .icon {
        font-size: 1.25rem;
        display: block;
        margin-bottom: 0.25rem;
    }

    .logo-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-left: 10px;
        margin-right: 10px;
        margin-bottom: 1rem;
    }

    .brand-text {
        color: white;
        font-size: 1rem;
    }
</style>