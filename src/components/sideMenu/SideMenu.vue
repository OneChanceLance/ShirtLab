<template>
  <nav class="side-menu">
    <MenuButton variant="Upload" label="Upload" :active="props.activeMenu === 'Upload'"
      @click="() => requestMenu('Upload', 'Choose File to Upload')" />
    <MenuButton variant="Text" label="Text" :active="props.activeMenu === 'Text'"
      @click="() => requestMenu('Text', 'Add Text')" />
    <MenuButton variant="Icons" label="Icons" :active="props.activeMenu === 'Icons'"
      @click="() => requestMenu('Icons', 'Select Icon')" />
    <MenuButton variant="Shapes" label="Shapes" :active="props.activeMenu === 'Shapes'"
      @click="() => requestMenu('Shapes', 'Choose Shape')" />
    <MenuButton variant="Colors" label="Product Colors" :active="props.activeMenu === 'Colors'"
      @click="() => requestMenu('Colors', 'Pick a Product Color')" />
    <MenuButton variant="Book" label="HOW TO USE" :active="props.activeMenu === 'Guide'"
      @click="() => requestMenu('Guide', 'ShirtLab Guide')" />
    <!--*<MenuButton variant="Sports"
      label="Sports Personalization" :active="props.activeMenu === 'Sports'"
      @click="() => requestMenu('Sports', 'Add Sports Info')" /> -->
  </nav>
</template>

<script setup lang="ts">

  import MenuButton from "./MenuButton.vue";
  const props = defineProps<{ activeMenu?: string | null }>();
  const emit = defineEmits<{ (e: 'request-menu', menu: string, title: string): void; }>();

  function requestMenu(menu: string, title: string) {
    emit('request-menu', menu, title);
  }
</script>

<style scoped>
  .side-menu {
    width: 13.5rem;
    height: 100%;
    background: rgb(75, 85, 93);
    display: flex;
    flex-direction: column;
    z-index: 1010;
    align-items: flex-start;
    justify-content: space-between;
  }

  .side-menu>* {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .side-menu>*:first-child {
    margin-top: 1rem;
  }

  .side-menu>*:last-child {
    margin-bottom: 1rem;
  }

  .title {
    color: #ffffff;
    text-transform: uppercase;
    z-index: 5;
    padding: 5px;
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
  .slide-enter-active,
  .slide-leave-active {
    transition: transform 0.3s ease;
  }

  .slide-enter-from,
  .slide-leave-to {
    transform: translateX(-100%);
  }

  .slide-enter-to,
  .slide-leave-from {
    transform: translateX(0);
  }
</style>
