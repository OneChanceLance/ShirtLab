<template>
  <div v-if="activeMenu" class="slide-menu">
    <div class="slide-menu-header">
      <button @click="closeMenu" class="close-btn">✕</button>
      <span class="menu-title">{{ activeMenu }}</span>
    </div>
    <div v-if="activeMenu === 'Clothing'">
      <div v-if="!showCreateForm" class="style-picker">
        <button v-for="style in CLOTHING_STYLES" :key="style.type"
          :class="['style-btn', { active: selectedStyle === style.type }]" @click="selectStyle(style.type)">
          {{ style.displayName }}
        </button>
      </div>
      <div v-if="!showCreateForm" class="clothes-list">
        <div v-for="brand in selectedStyleConfig?.brands || []" :key="brand" class="clothes-item"
          :class="{ selected: getBrandTemplate(brand)?.name === selectedClothing }"
          @click="selectClothing(getBrandTemplate(brand)?.name || 'Loading')">
          <img :src="getBrandTemplate(brand)?.image" class="clothes-thumb" />
          <span>{{ brand }}</span>
        </div>
        <div class="clothes-item create-new" @click="startCreating">
          <span id="create">＋ Create</span>
        </div>
      </div>

      <div v-if="showCreateForm" class="create-form">
        <button @click="cancelCreating" class="back-btn" style="align-self: flex-start; margin-bottom: 0.5rem;">←
          Back</button>
        <input :class="['style-text']" v-model="newClothingName" placeholder="Name" />
        <label :class="['style-upload']">
          <span>Upload</span>
          <input  type="file" @change="handleImageUpload" />
        </label>
        <span>Style</span>
        <div class="selector-group">

          <button v-for="style in CLOTHING_STYLES" :key="style.type"
            :class="['style-btn', { active: newClothingCategory === style.type }]" @click="newClothingCategory = style.type">
            {{ style.displayName }}
          </button>
        </div>
        <span>Size</span>
        <div class="selector-group">
          <label v-for="size in allSizes" :key="size">
            <button :key="size" type="button" :class="['style-btn', { active: newClothingSizes.includes(size) }]"
              @click="() => {
                const idx = newClothingSizes.indexOf(size);
                if (idx === -1) newClothingSizes.push(size);
                else newClothingSizes.splice(idx, 1);
              }">
              {{ size.toUpperCase() }}
            </button>
          </label>
        </div>
        <span>Gender</span>
        <div class="selector-group">
          <label v-for="gender in allowedGenders" :key="gender">
            <button type="button" :class="['style-btn', { active: newClothingGenders.includes(gender) }]" @click="() => {
              const idx = newClothingGenders.indexOf(gender);
              if (idx === -1) newClothingGenders.push(gender);
              else newClothingGenders.splice(idx, 1);
            }">
              {{ gender.charAt(0).toUpperCase() + gender.slice(1) }}
            </button>
          </label>
        </div>
        <button @click="saveNewClothing">Save</button>
      </div>

      <div v-if="!showCreateForm" class="selector-row">
        <div class="selector-meta">
          <span>Size</span>
        </div>
        <div class="selector-group">

          <button v-for="size in allowedSizes" :key="size" :class="['selector-btn', { active: selectedSize === size }]"
            @click="selectSize(size)">
            {{ size.toUpperCase() }}
          </button>
        </div>
        <div class="selector-meta">
          <span>Gender</span>
        </div>
        <div class="selector-group">
          <button v-for="gender in allowedGenders" :key="gender"
            :class="['selector-btn', { active: selectedGender === gender }]" @click="selectGender(gender)">
            {{ gender.charAt(0).toUpperCase() + gender.slice(1) }}
          </button>
        </div>
      </div>
    </div>
    <div v-else-if="activeMenu === 'Design'">
      <button @click="emit('triggerDesignUpload')" class="upload-btn">Upload Image</button>
      <div class="uploaded-list">
        <div class="uploaded-item" v-for="n in 3" :key="n">
          <img :src="'https://via.placeholder.com/64?text=Design+' + n" />
          <span>Design {{ n }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="activeMenu === 'Text'">Coming soon: Text options!</div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { CLOTHING_TEMPLATES, CLOTHING_STYLES } from '../shirtlab/clothesDb';
  import { useClothingStore } from '../../stores/clothingStore';
  import { supabase } from '../../supabase';
  const clothingStore = useClothingStore();

  const isCreating = ref(false);

  const emit = defineEmits(['closeMenu', 'triggerDesignUpload', 'selectClothing', 'selectClothingAttributes']);

  defineProps({
    activeMenu: String
  })

  const showCreateForm = ref(false);
  const newClothingName = ref('');
  const newClothingCategory = ref('');
  const newClothingSizes = ref<string[]>([]);
  const newClothingGenders = ref<string[]>([]);
  const newClothingImage = ref<File | null>(null);
  const newClothingGrid = ref<{ x: number, y: number, w: number, h: number } | null>(null);

  async function handleImageUpload(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      const file = files[0];
      newClothingImage.value = file;

      // Upload file to Supabase Storage bucket
      const { data, error } = await supabase
        .storage
        .from('clothing-images')
        .upload(`public/${Date.now()}-${file.name}`, file);

      if (error) {
        console.error('Supabase upload error:', error);
        return;
      }

      const imageUrl = supabase.storage.from('clothing-images').getPublicUrl(data.path).data.publicUrl;

      // Save metadata to Supabase table, include grid boundary
      const { error: insertError } = await supabase
        .from('clothing_items')
        .insert([{
          name: newClothingName.value,
          category: newClothingCategory.value,
          sizes: newClothingSizes.value,
          genders: newClothingGenders.value,
          image_url: imageUrl,
          grid: newClothingGrid.value
        }]);

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return;
      }

      console.log('Clothing item uploaded and saved to Supabase.');
    }
  }

  function startCreating() {
    isCreating.value = true;
    showCreateForm.value = true;
    clothingStore.setIsCreating(true);
    // Set the grid boundary from the current clothing details (or however you track it)
    newClothingGrid.value = clothingStore.clothingDetails?.grid
      ? { ...clothingStore.clothingDetails.grid }
      : null;
  }

  function saveNewClothing() {
    clothingStore.createClothing({
      name: newClothingName.value,
      category: newClothingCategory.value,
      sizes: newClothingSizes.value,
      genders: newClothingGenders.value,
      image: newClothingImage.value,
      grid: newClothingGrid.value
    });
    clothingStore.setIsCreating(false);
    showCreateForm.value = false;
    isCreating.value = false;
  }

  function cancelCreating() {
    showCreateForm.value = false;
    isCreating.value = false;
    clothingStore.setIsCreating(false);
  }

  function closeMenu() {
    emit('closeMenu');
    showCreateForm.value = false;
    isCreating.value = false;
    clothingStore.setIsCreating(false);
  }


  const selectedStyle = ref(CLOTHING_STYLES[0].type);
  const selectedStyleConfig = computed(() =>
    CLOTHING_STYLES.find(style => style.type === selectedStyle.value)
  );

  const allSizes = ["xs", "s", "m", "l", "xl"]
  const allowedSizes = computed(() => selectedStyleConfig.value?.sizes || []);
  const allowedGenders = computed(() => selectedStyleConfig.value?.genders || []);

  const selectedGender = ref(allowedGenders.value[0] || '');
  const selectedClothing = ref(
    CLOTHING_TEMPLATES.find(t => t.type === selectedStyle.value && t.gender === selectedGender.value)?.name ||
    CLOTHING_TEMPLATES.find(t => t.type === selectedStyle.value)?.name ||
    ''
  );
  const selectedSize = ref(allowedSizes.value[0] || '');

  const selectedTemplate = computed(() =>
    CLOTHING_TEMPLATES.find(
      t => t.type === selectedStyle.value && t.gender === selectedGender.value
    )
  );

  const getBrandTemplate = (brand: string) =>
    CLOTHING_TEMPLATES.find(
      t => t.type === selectedStyle.value && t.gender === selectedGender.value && t.brand === brand
    );


  function selectStyle(type: string) {
    selectedStyle.value = type;
    const styleConfig = CLOTHING_STYLES.find(style => style.type === type);
    // Default to first allowed gender for this style
    selectedGender.value = styleConfig?.genders[0] || '';
    // Find a template for this style/gender
    const firstTemplate = CLOTHING_TEMPLATES.find(
      t => t.type === type && t.gender === selectedGender.value
    );
    selectedClothing.value = firstTemplate?.name || '';
    selectedSize.value = styleConfig?.sizes[0] || '';
    emit('selectClothing', {
      name: selectedClothing.value,
      image: selectedTemplate.value?.image,
      grid: selectedTemplate.value?.grid
    });
    emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
  }

  function selectClothing(name: string) {
    selectedClothing.value = name;
    const newTemplate = CLOTHING_TEMPLATES.find(t => t.name === name);
    if (newTemplate) {
      selectedStyle.value = newTemplate.type;
      selectedGender.value = newTemplate.gender;
      const newStyle = CLOTHING_STYLES.find(style => style.type === newTemplate.type);
      selectedSize.value = newStyle?.sizes[0] || '';
      emit('selectClothing', {
        name: selectedClothing.value,
        image: newTemplate.image,
        grid: newTemplate.grid,
        style: selectedStyle.value,
        gender: selectedGender.value,
        size: selectedSize.value
      });
      emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
    }
  }

  function selectSize(size: string) {
    selectedSize.value = size;
    emit('selectClothing', {
      name: selectedClothing.value,
      image: selectedTemplate.value?.image,
      grid: selectedTemplate.value?.grid,
      style: selectedStyle.value,
      gender: selectedGender.value,
      size: selectedSize.value
    });
    emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
  }

  function selectGender(gender: string) {
    selectedGender.value = gender;
    // Update clothing selection to match new gender
    const template = CLOTHING_TEMPLATES.find(
      t => t.type === selectedStyle.value && t.gender === gender
    );
    selectedClothing.value = template?.name || '';
    emit('selectClothing', {
      name: selectedClothing.value,
      image: selectedTemplate.value?.image,
      grid: selectedTemplate.value?.grid,
      style: selectedStyle.value,
      gender: selectedGender.value,
      size: selectedSize.value
    });
    emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
  }

  // Watch for changes to style/gender to update selectedClothing and selectedTemplate
  watch([selectedStyle, selectedGender], ([newStyle, newGender]) => {
    const template = CLOTHING_TEMPLATES.find(
      t => t.type === newStyle && t.gender === newGender
    );
    if (template) {
      selectedClothing.value = template.name;
    }
  });
</script>

<style scoped>
  .create-new {
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    font-weight: 600;
    margin: 0 autos;
  }

  #create {
    font-weight: 200;
    margin: auto;
    font-size: 2rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif
  }

  .create-form {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .slide-menu {
    position: fixed;
    top: 4rem;
    left: 10rem;
    width: 350px;
    height: 75vh;

    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.6);
    padding-left: 2rem;
    padding-right: 2rem;
    color: white;
    z-index: 1;
    border-bottom-right-radius: 15px;
    border-top-right-radius: 15px;
    border-bottom-left-radius: 10px;

    border-right: 3px solid #3aff68;
    border-bottom: 3px solid #3aff68;
  }


  .slide-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

  }

  .close-btn {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .menu-title {
    font-size: 1.25rem;
    font-weight: bold;
  }

  .upload-btn {
    background-color: #94C940;
    border: none;
    padding: 0.5rem 1rem;
    color: #222;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 1rem;
  }

  .uploaded-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
  }

  .uploaded-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem;
    border-radius: 8px;
  }

  .uploaded-item img {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 6px;
  }

  .clothes-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    height: 50vh;
  }

  .clothes-item {
    width: auto;
    min-height: 72px;
    height: auto;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    overflow: hidden;
  }

  .clothes-item:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .clothes-thumb {
    width: 50px;
    height: 56px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
    margin-bottom: 0;
    margin-right: 1rem;
  }

  .clothes-item span {
    text-align: left;
    margin-top: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    flex: 0 0 auto;
  }

  .selected {
    border: 2px solid #3aff68;
    background: rgba(58, 255, 104, 0.3);
  }

  .selector-row {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .selector-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .selector-label {
    font-weight: 600;
    min-width: 50px;
  }

  .selector-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  .selector-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .selector-btn.active {
    background: #3aff68;
    color: #222;
    font-weight: 700;
  }

  .selector-meta {
    margin-top: -0.8rem;
    margin-bottom: -0.8rem;
    text-align: center;
    font-size: 0.78rem;
    color: #b4b4b4;
    letter-spacing: 0.02em;
    justify-content: center;
  }

  .style-picker {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    justify-content: center;
  }

  .style-btn  {
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    border-radius: 16px;
    padding: 0.25rem 0.9rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;


  }

  .style-text {
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    border-radius: 0.23rem;
    padding: 0.25rem 0.9rem;
    font-size: 1rem;
    transition: background 0.2s;
    appearance:unset;
    outline: none;
    box-shadow: none;
  }


  .style-upload {
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    border-radius: 0.23rem;
    padding: 0.25rem 0.9rem;
    font-size: 1rem;
    transition: background 0.2s;
    appearance:unset;
    outline: none;
    box-shadow: none;
        cursor: pointer;
  }
  
  .style-upload input {
            display: none;

  }

  .style-btn.active {
    background: #3aff68;
    color: #222;
    font-weight: 600;
  }

</style>

<style scoped></style>