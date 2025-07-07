<template>

  <nav class="side-menu">
    <a href="https://seeourdesigns.com" target="_blank" rel="noopener" class="logo-row">
      <img class="logo" :src="logo" />

      <span class="brand-text"><strong>ShirtLab</strong> by SOD</span>
    </a>
    </hr>
    <MenuButton variant="Shirt" label="Clothing" :active="activeMenu === 'Clothing'" @click="() => openMenu('Clothing')" />
    <MenuButton variant="Design" label="Designs" :active="activeMenu === 'Design'" @click="() => openMenu('Design')" />
    <MenuButton variant="Text" label="Text" :active="activeMenu === 'Text'" @click="() => openMenu('Text')" />

    
  </nav>
  <transition name="slide">
      <MenuContent
        :active-menu="activeMenu ?? undefined"
        @close-menu="openMenu"
        @trigger-design-upload="emit('triggerDesignUpload')"
        @select-clothing="emit('selectClothing', $event)"
      />
    </transition>

</template>

<script setup lang="ts">
  import MenuButton from './MenuButton.vue';
  import logo from '../../assets/logo.png';
  import { ref } from 'vue'
import MenuContent from './MenuContent.vue';

  const emit = defineEmits<{
    (e: 'selectTool', tool: string): void,
    (e: 'triggerDesignUpload'): void,
    (e: 'uploadDecal', src: string): void,
    (e: 'selectClothing', details: any): void
  }>()

  const activeMenu = ref<string | null>(null)

  function openMenu(menu: string) {
    activeMenu.value = activeMenu.value === menu ? null : menu
  }
</script>

<style scoped>
.side-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 10rem;
  height: 100vh;
  background: #232323;
  display: flex;
  flex-direction: column;
  z-index: 1010;
  align-items: flex-start;
  padding-top: 10px;
}

  .title {
    color: #ffffff;
    font-weight: 00;
    text-transform: uppercase;
    z-index: 5;
    padding: 5px;
  }

  .menu-item:hover {
    background-color: #928282;
  }

  .menu-item.active {
    background-color: #2a2a2a;
    

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
        z-index: 5;
  }

  .brand-text {
    color: white;
    font-size: 1rem;
  }

/* Slide transition */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateX(-100%);
}
.slide-enter-to, .slide-leave-from {
  transform: translateX(0);
}
</style>