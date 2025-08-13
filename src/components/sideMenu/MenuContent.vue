<template>
  <div>
    <div v-if="activeMenu" class="slide-menu">
      <div class="slide-menu-header">
        <button v-on:click="activeMenu === 'Text' ? fontPageRef?.backPage?.() : null" class="back-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"
            class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span class="menu-title">{{ headerTitle }}</span>
        <button @click="closeMenu" class="close-btn">
          <CloseIcon />
        </button>
      </div>
      <div class="slide-menu-content">
        <div v-if="activeMenu === 'Clothing'">

          <div v-if="!showCreateForm && !showStylingPage">
            <TabOption :options="categories" :model-value="selectedCategory" :valueKey="'category'"
              @update:modelValue="(value) => selectCategory(value)" />

            <TabOption v-if="selectedCategory !== ''" :options="filteredSubcategories"
              :model-value="selectedSubcategory" :valueKey="'name'" size="small"
              @update:modelValue="(value) => selectSubcategory(value)" />

            <TextInputLong name="Search" />
          </div>
          <div v-if="!showCreateForm && !showStylingPage" class="clothes-list">
            <div v-for="item in selectedClothingList" :key="item.id" class="clothes-item"
              :class="{ selected: item.name === selectedClothing }" @click="selectClothing(item)">
              <img :src="getBrandLogo(item.brand) || item.image_url" class="clothes-thumb" />
              <div class="details">
                <span class="name">{{ item.name }}</span>
                <span class="brand">{{ item.brand }}</span>
                <div class="sizes">
                  <span v-for="size in sortedSizes(item.sizes)" :key="size" class="size-marker">
                    {{ size.toUpperCase() }}
                  </span>
                </div>
              </div>
            </div>
            <div class="clothes-item create-new" @click="startCreating">
              <span id="create">＋</span>
            </div>
          </div>

          <div v-if="showCreateForm" class="create-form">
            <button @click="cancelCreating" class="back-btn" style="align-self: flex-start; margin-bottom: 0.5rem;">←
              Back</button>
            <input :class="['style-text']" v-model="newClothingName" placeholder="Name" />
            <input type="text" v-model="selectedBrand" placeholder="Brand" class="style-text"
              @focus="showBrandSuggestions = true" @click="showBrandSuggestions = true" />
            <div v-if="filteredBrands.length" class="brand-suggestions">
              <div v-for="brand in filteredBrands" :key="brand" class="brand-suggestion-item"
                @click="selectBrand(brand)">
                <img :src="getBrandLogo(brand)" alt="" class="brand-logo-suggestion" />
                <span>{{ brand }}</span>
              </div>
            </div>

            <StyleOptions label="Gender" :options="gendersList" :model-value="newClothingGenders" :valueKey="'code'"
              :display-key="'label'" />
            <StyleOptions label="Style" :options="categories" :model-value="newClothingCategory" :valueKey="'category'"
              :display-key="'name'" />
            <StyleOptions label="Size" :options="allSizes" :model-value="newClothingSizes" multiple />


            <span id="colors-span">Colors<button id="create-color">
                <PlusIcon />
              </button></span>



            <!-- SSActivewear URL input and color fetch/display -->
            <span>SSActivewear URL</span>
            <input type="text" v-model="ssactivewearUrl" placeholder="Paste SSActivewear product URL"
              class="style-text" />
            <button @click="fetchSSActivewearColors" :disabled="!isFetchingColors && ssactivewearColors.length"
              style="margin-top: 0.5rem;">
              {{
                isFetchingColors
                  ? 'Fetching... (' + ssactivewearColors.length + ')'
                  : ssactivewearColors.length
                    ? ssactivewearColors.length + ' colors found'
                    : 'Fetch Colors'
              }}
            </button>

            <button @click="saveNewClothing">Upload to Database</button>
          </div>

          <div v-if="showStylingPage" class="styling-page">
            <button @click="showStylingPage = false" class="back-btn">← Back</button>
            <div class="selector-row">
              <StyleOptions label="Size" :options="allSizes" :model-value="newClothingSizes" />

              <div class="selector-meta">
                <span>Color</span>
              </div>
              <div class="selector-group colors-group">
                <div v-for="color in ssactivewearColors" :key="color.name || color" class="color-circle"
                  :title="color.name || color" :style="{ backgroundImage: 'url(' + color.imageUrl + ')' }"></div>
              </div>

            </div>
          </div>
        </div>
        <div v-else-if="activeMenu === 'Upload'">
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFileChange" />
          <div class="upload-container" @click="openFileDialog" @dragover="handleDragOver" @dragleave="handleDragLeave"
            @drop="handleDrop" :class="{ 'drag-hover': isDragging }">
            <h3>High resolution artwork prints the best!</h3>
            <span>Lower than 300ppi artwork may result in a blurry print with pixelated edges.</span>
            <div class="upload-img-container">
              <img :src="uploadDark" class="upload-img" />
              <p>Drag and Drop or
                <a class="underlined">
                  Browse
                </a>
                Your Computer
              </p>
            </div>
            <p>
              *Acceptable file types:
              <br />
              {{ allowedTypesDisplay }}*
              <br />
              (Max {{ maxFileSizeMB }}MB)
            </p>
          </div>
          <div class="upload-details">
            <h4>Having issues uploading your art?</h4>
            <p>If your file type is unsupported, or you're facing other problems trying to upload your design shoot us
              an email at <a style="color: #94C940"> cs@seeourdesigns.com.</a></p>
            <p>Our team will review your file and follow up with you before processing your order!</p>
          </div>
        </div>
        <template v-else-if="activeMenu === 'Text'">
          <FontPage ref="fontPageRef" :selectedText="selectedText" :draw="draw"
            @uploadText="(payload: any) => emit('uploadObject', 'text', payload)" @center-text="$emit('center-text')"
            @duplicate-text="$emit('duplicate-text')" @bring-forward="$emit('bring-forward')"
            @send-back="$emit('send-back')" />
        </template>
      </div>
    </div>
    <div v-if="autofillPrompt" class="custom-block">
      <!-- Your custom content here -->
      <span>Autofill?</span>
      <div>
        <p>{{ autofillPrompt }}</p>
        <button class="autofill-btn yes" @click="() => {
          selectedBrand = ssactivewearBrand;
          newClothingName = ssactivewearStyle; // Autofill the name to the style instead
          showBrandSuggestions = false;
          autofillPrompt = '';
        }">Yes</button>
        <button class="autofill-btn no" @click="autofillPrompt = ''">No</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, type Ref } from 'vue';

  import PlusIcon from 'vue-material-design-icons/Plus.vue'
  import CloseIcon from 'vue-material-design-icons/Close.vue'
  import uploadDark from './assets/uploadDark.png'
  import { useClothingStore } from '../../stores/clothingStore';
  import { supabase } from '../../supabase';
  import StyleOptions from './StyleOptions.vue';
  import TabOption from './TabOption.vue';
  import { getClothingItems } from '../shirtlab/clothesDb';
  import TextInputLong from '../textInputs/TextInputLong.vue';
  import FontPage from './FontPage.vue';
  import type { TextObject } from '../shirtlab/types';


  const isDragging = ref(false);
  const fontPageRef = ref();

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging.value = true;
  }

  function handleDragLeave() {
    isDragging.value = false;
  }



  const fileInput = ref<HTMLInputElement | null>(null);

  function openFileDialog() {
    fileInput.value?.click();
  }
  function validateFile(file: File): boolean {
    const isValidType = allowedTypes.includes(file.type);
    const isValidSize = file.size <= maxFileSizeMB * 1024 * 1024;
    return isValidType && isValidSize;
  }

  function onFileChange(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (files?.length && validateFile(files[0])) {
      emit('uploadObject', 'image', { imgUrl: URL.createObjectURL(files[0]) });
    } else {
      alert(`File must be one of: ${allowedTypes.join(', ')} and under ${maxFileSizeMB}MB`);
    }
  }



  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging.value = false;
    const files = event.dataTransfer?.files;
    if (files?.length && validateFile(files[0])) {
      emit('uploadObject', 'image', { imgUrl: URL.createObjectURL(files[0]) });
    } else {
      alert(`File must be one of: ${allowedTypes.join(', ')} and under ${maxFileSizeMB}MB`);
    }
  }
  const allowedTypes = ['image/png', 'image/ai', 'image/eps', 'image/pdf', 'image/heic', 'image/avif', 'image/tiff', 'image/svg+xml'];
  const maxFileSizeMB = 20; // MB
  const allowedTypesDisplay = computed(() => {
    return allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
  });
  const allBrands = ['BELLA + CANVAS', 'Gildan', 'Hanes', 'Tultex', 'H&M', 'Nike', 'Uniqlo', 'Gap', 'J.Crew']; // Example brands

  const selectedBrand = ref('');
  const showBrandSuggestions = ref(true);
  const autofillPrompt = ref('');
  const ssactivewearBrand = ref('');
  const ssactivewearStyle = ref('');

  const filteredBrands = computed(() =>
    showBrandSuggestions.value
      ? allBrands.filter(b => b.toLowerCase().includes(selectedBrand.value.toLowerCase()) && selectedBrand.value)
      : []
  );

  function selectBrand(brand: string) {
    selectedBrand.value = brand;
    showBrandSuggestions.value = false;
  }


  const clothingItems = ref<ClothingItem[]>([]);

  // Live categories, subcategories, genders
  const categories = ref([]);
  const subcategories = ref([]);
  const gendersList = ref([]);
  const selectedCategory = ref('');
  const selectedSubcategory = ref('');



  // Type for clothing items
  type ClothingItem = {
    id: string;
    name: string;
    category: string;
    sizes: string[];
    genders: string[];
    image_url: string;
    grid: { x: number; y: number; w: number; h: number };
    brand?: string;
  };

  // SSActivewear URL and fetched colors
  const ssactivewearUrl = ref('');
  const ssactivewearColors = ref<string[]>([]);
  const isFetchingColors = ref(false);

  const clothingStore = useClothingStore();

  const isCreating = ref(false);

  const emit = defineEmits<{
    (e: 'closeMenu'): void;
    (e: 'uploadObject', type: string, payload: any): void;
    (e: 'selectClothing'): void;
    (e: 'selectClothingAttributes'): void;
    (e: 'center-text'): void;
    (e: 'duplicate-text'): void;
    (e: 'bring-forward'): void;
    (e: 'send-back'): void;
  }>();




  defineProps<{
    activeMenu: string,
    headerTitle: string,
    selectedText: TextObject | null,
    draw: () => void
  }>()

  function logCategoriesAndSubcategories() {
    console.log('Categories:', categories.value);
    console.log('Subcategories:', subcategories.value);
  }

  onMounted(async () => {
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .order('code', { ascending: true });
    const { data: subcategoriesData } = await supabase
      .from('subcategories')
      .select('*')
      .order('category_code', { ascending: true })
      .order('code', { ascending: true });
    const { data: gendersData } = await supabase
      .from('genders')
      .select('*')
      .order('code', { ascending: true });

    if (categoriesData) categories.value = categoriesData;
    if (subcategoriesData) subcategories.value = subcategoriesData;
    if (gendersData) gendersList.value = gendersData;
    logCategoriesAndSubcategories();
    clothingItems.value = await getClothingItems();
  })

  const showCreateForm = ref(false);
  const newClothingName = ref('');
  const newClothingCategory = ref('');
  const newClothingSizes = ref<string[]>([]);
  const newClothingGenders = ref<string[]>([]);
  // This will hold a File or a string URL; for our use, we set it to string (URL)
  const newClothingImage = ref<any>(null);
  const newClothingGrid = ref<{ x: number, y: number, w: number, h: number } | null>(null);


  const filteredSubcategories = computed(() => {
    if (!selectedCategory.value) return [];
    const categoryConfig = categories.value.find(cat => cat.category === selectedCategory.value);
    if (!categoryConfig) return [];
    return subcategories.value.filter(sub => sub.category_code === categoryConfig.code);
  });

  const selectedClothingList = computed(() => {
    const categoryCode = categories.value.find(cat => cat.category === selectedCategory.value)?.code;
    const subcategoryCode = subcategories.value.find(sub => sub.name === selectedSubcategory.value)?.code;

    return clothingItems.value.filter(item =>
      item.category_code === categoryCode &&
      (!selectedSubcategory.value || item.subcategory_code === subcategoryCode)
    );
  });

  // Handle "image upload" by setting preview to the first SSActivewear color's background
  // When SSActivewear colors are fetched, auto-set the image and send to ShirtPlacer via Pinia
  function autoSetClothingImageAndSendToStore() {
    newClothingImage.value = ssactivewearColors.value[0]?.colorBackground || '';
    console.log({
      name: newClothingName.value,
      category: newClothingCategory.value,
      sizes: newClothingSizes.value,
      genders: newClothingGenders.value,
      grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
      brand: selectedBrand.value,
      colors: ssactivewearColors.value.map(color => ({
        name: color.name || color,
        colorBackground: color.colorBackground || '',
        colorStyleID: color.colorStyleID || '',
        background: color.background || ''
      }))
    })

    // Immediately update Pinia store to send image to ShirtPlacer live
    clothingStore.createClothing({
      name: newClothingName.value,
      category: newClothingCategory.value,
      sizes: newClothingSizes.value,
      genders: newClothingGenders.value,
      grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
      brand: selectedBrand.value,
      colors: ssactivewearColors.value.map(color => ({
        name: color.name || color,
        colorBackground: color.colorBackground || '',
        colorStyleID: color.colorStyleID || '',
        background: color.background || ''
      }))
    });
  }


  function startCreating() {
    isCreating.value = true;
    showCreateForm.value = true;
    clothingStore.setIsCreating(true);
    // Set the grid boundary directly from the currentGrid in clothingStore
    newClothingGrid.value = clothingStore.currentGrid ?? null;
  }

  async function saveNewClothing() {
    // If a manual image was uploaded, upload it to Supabase Storage
    let uploadedSupabaseUrl = '';
    if (newClothingImage.value) {
      const { data, error } = await supabase
        .storage
        .from('clothing-images')
        .upload(`public/${Date.now()}-${newClothingImage.value.name}`, newClothingImage.value);
      if (error) {
        console.error('Supabase upload error:', error);
        return;
      }
      uploadedSupabaseUrl = supabase.storage.from('clothing-images').getPublicUrl(data.path).data.publicUrl;
    }
    // Use uploaded URL if manual image, otherwise use ssactivewearColors[0]?.colorBackground


    // Save metadata to Supabase table, include live grid boundary and SSActivewear fields
    const { error: insertError } = await supabase
      .from('clothing_items')
      .insert([{
        name: newClothingName.value,
        category: newClothingCategory.value,
        sizes: newClothingSizes.value,
        genders: newClothingGenders.value,
        grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
        brand: selectedBrand.value,
        colors: ssactivewearColors.value.map(color => ({
          name: color.name || color,
          colorBackground: color.colorBackground || '',
          colorStyleID: color.colorStyleID || '',
          background: color.background || ''
        }))
      }]);

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return;
    }

    console.log('Clothing item uploaded and saved to Supabase.');

    // Always use only the first color's colorBackground for ShirtPlacer, and do not send image property
    clothingStore.createClothing({
      name: newClothingName.value,
      category: newClothingCategory.value,
      sizes: newClothingSizes.value,
      genders: newClothingGenders.value,
      grid: clothingStore.currentGrid ? { ...clothingStore.currentGrid } : {},
      brand: selectedBrand.value,
      colors: ssactivewearColors.value.map(color => ({
        name: color.name || color,
        colorBackground: color.colorBackground || '',
        colorStyleID: color.colorStyleID || '',
        background: color.background || ''
      }))
    });

    clothingStore.setIsCreating(false);
    showCreateForm.value = false;
    isCreating.value = false;
  }

  // Fetch SSActivewear colors from your Supabase Edge Function
  async function fetchSSActivewearColors() {
    if (!ssactivewearUrl.value) return;
    isFetchingColors.value = true;
    ssactivewearColors.value = [];
    try {
      // Extract productId from the SSActivewear product URL
      // Example: https://www.ssactivewear.com/p/somebrand/12345
      const match = ssactivewearUrl.value.match(/\/([^\/?#]+)$/);
      const productId = match ? match[1] : null;
      if (!productId) {
        throw new Error('Could not extract productId from SSActivewear URL');
      }
      console.log(productId)

      // Call your Supabase Edge Function (real deployed URL)
      const endpoint = 'https://xtjikprktetrshhpbeca.supabase.co/functions/v1/ssactivewear-proxy'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId, url: ssactivewearUrl.value })
      });
      if (!response.ok) {
        throw new Error('Failed to fetch from SSActivewear API');
      }
      const data = await response.json();
      console.log('SSActivewear API response:', data);

      if (Array.isArray(data.colors)) {
        ssactivewearColors.value = data.colors;
        console.log('Scraped colors:', ssactivewearColors.value);
        // After setting colors, set newClothingImage and update Pinia store for ShirtPlacer live
        autoSetClothingImageAndSendToStore();
      } else {
        console.log('No colors array found in response.');
      }

      // Optionally autofill the brand if available
      if (data.brand) {
        autofillPrompt.value = `Autofill brand with "${data.brand}"?`;
        ssactivewearBrand.value = data.brand;
      }
      // Optionally autofill the style if available
      if (data.style) {
        ssactivewearStyle.value = data.style;
      } else {
        ssactivewearStyle.value = '';
      }

    } catch (error) {
      console.error('Error fetching SSActivewear info:', error);
    } finally {
      isFetchingColors.value = false;
    }
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



  const allSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]
  const allowedSizes = computed(() => {
    const currentItem = selectedClothingList.value.find(item => item.name === selectedClothing.value);
    return currentItem?.sizes || [];
  });

  const selectedGender = ref();
  const selectedClothing = ref<string | null>(null);
  const selectedSize = ref();

  function selectCategory(category: string | undefined) {
    selectedCategory.value = category || '';
    selectedSubcategory.value = '';
    selectedGender.value = gendersList.value[0]?.code || '';
    selectedClothing.value = null;
    emit('selectClothing', { name: selectedClothing.value, image: '', grid: null });
    emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
    logCategoriesAndSubcategories();
  }

  function selectSubcategory(subcategory: string | undefined) {
    selectedSubcategory.value = subcategory || '';
  }

  const showStylingPage = ref(false);
  function selectClothing(item) {
    selectedClothing.value = item.name;
    ssactivewearColors.value = item.colors || []; // Load saved colors if present
    // Use color.colorBackground (or background) for styling image
    let colorImage =
      (ssactivewearColors.value[0] && (ssactivewearColors.value[0].colorBackground || ssactivewearColors.value[0].background))
      || item.image_url;
    emit('selectClothing', {
      name: item.name,
      image: colorImage,
      grid: item.grid,
      style: item.category,
      genders: item.genders,
      sizes: item.sizes
    });
    showStylingPage.value = true;
  }
  function sortedSizes(sizes: string[] = []) {
    return [...sizes].sort((a, b) => allSizes.indexOf(a.toLowerCase()) - allSizes.indexOf(b.toLowerCase()));
  }

  function selectSize(size: string) {
    selectedSize.value = size;
    emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
  }

  function getBrandLogo(brand: string) {
    const logos: Record<string, string> = {
      ['BELLA + CANVAS']: '/logos/bellacanvas.png',
      ['Gildan']: '/logos/gildan.png',
      ['Hanes']: '/logos/hanes.png',
      ['Tultex']: '/logos/tultex.png',
      ['H&M']: '/logos/handm.png',
      ['Nike']: '/logos/nike.jpg',
      ['Uniqlo']: '/logos/uniqlo.png',
      ['Gap']: '/logos/gap.png',
      ['J.Crew']: '/logos/jcrew.png'
    };
    return logos[brand] || '';
  }

  function selectGender(gender: string) {
    selectedGender.value = gender;
    emit('selectClothingAttributes', { size: selectedSize.value, gender: selectedGender.value });
  }

</script>

<style scoped lang="scss">

  .slide-menu {
    position: fixed;
    top: 0;
    width: 30rem;
    max-height: 100%;
    background-color: rgb(255, 255, 255);
    color: white;
    z-index: 1;
    border-bottom-right-radius: 20px;
    border-top-right-radius: 20px;

    display: flex;
    flex-direction: column;
  }


  .slide-menu-header {
    font-family: 'Anek Latin';
    align-items: center;
    display: flex;
    justify-content: space-between;
    background-color: rgb(107, 112, 120);
    height: 1rem;
    font-size: 1rem;

    line-height: 1rem;
    border-top-right-radius: 20px;
  }

  .menu-title {
    flex-grow: 0.83;
    text-align: center;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    line-height: 1rem;
    scale: 0.75;
  }

  .back-btn {
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    line-height: 1rem;
    scale: 0.75;

  }

  .slide-menu-content {
    margin: 1.5rem;
    color: #232323;
    font-family: 'Anek Latin';
    margin-top: 1rem;
  }


  .upload-img {
    height: 5rem;
    margin: 0rem;
    margin-top: 3rem;
    object-fit: contain;
  }

  .upload-container {
    background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='20' ry='20' stroke='%236B7078FF' stroke-width='2' stroke-dasharray='5%2c10' stroke-dashoffset='15' stroke-linecap='square'/%3e%3c/svg%3e");
    border-radius: 20px;
    height: 15rem;
    margin-left: 1rem;
    margin-right: 1rem;
    margin-top: 1rem;
    padding: 1rem;
    padding-bottom: 3rem;
    font-weight: 300;
    cursor: pointer;

    h3 {
      margin: 0rem;
      margin-bottom: -0.5rem;
      font-size: 1rem;
      font-weight: 600
    }

    span {
      margin: 0rem;
      font-size: 0.6rem;
    }

    p {
      margin: 1rem;
      font-size: 0.75rem;
    }

  }

  .upload-img-container {
    margin-top: -1rem;
    padding-bottom: 0.5rem;

    .underlined {
      border-bottom: 2px solid #94C940;
      height: 21px;
      color: inherit;
      text-decoration: none;
      display: inline-block;
      vertical-align: top;
    }

    p {
      margin: 0;
      font-size: large;
      font-weight: 500
    }
  }

  .upload-details {
    margin: auto;
    width: 80%;
    text-align: left;
    font-size: small;
    margin-top: 2rem;

    h4 {
      margin-bottom: 0;
    }

    p {
      margin-top: 0;
    }
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
    height: 35rem;
    scrollbar-width: none;
    border-radius: 0.5rem;
    /* Firefox */
  }

  .clothes-list::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari */
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
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    overflow: hidden;
  }

  .clothes-item:hover {
    background: rgba(255, 255, 255, 0.2);
  }


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
    margin: 0 auto;
    font-size: 2rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif
  }

  .create-form {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    position: relative;
  }

  .clothes-thumb {
    width: 4rem;
    height: 4rem;
    object-fit: cover;
    border-radius: 6px;
    display: block;
    margin-bottom: 0;

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
    margin-top: auto;
    margin-bottom: 1.5rem;
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
    margin-top: 0.2rem;
    margin-bottom: -1rem;
    text-align: center;
    font-size: 0.78rem;
    color: #b4b4b4;
    letter-spacing: 0.02em;
    justify-content: center;
  }

  .style-btn {
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    border-radius: 10px;
    padding: 0.25rem 0.9rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .style-btn.active {

    background: #3aff68;
    color: #222;
    font-weight: 600;
    z-index: -1;
  }


  .style-text {
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    border-radius: 0.23rem;
    padding: 0.25rem 0.9rem;
    font-size: 1rem;
    transition: background 0.2s;
    appearance: unset;
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
    appearance: unset;
    outline: none;
    box-shadow: none;
    cursor: pointer;
  }

  .style-upload input {
    display: none;

  }



  .brand-suggestions {
    position: absolute;
    background: #232323;
    border-radius: 4px;
    max-height: 150px;
    overflow-y: auto;
    margin-top: 7.2rem;
    z-index: 15;
    width: calc(100%);
  }

  .brand-suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    cursor: pointer;
  }

  .brand-suggestion-item:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .brand-logo-suggestion {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .details {
    display: flex;
    flex-direction: column;
  }

  .details .brand {
    font-size: 0.8rem;
    font-weight: 400;
  }


  .details .sizes {
    display: flex;
    flex-direction: row;
    margin-top: 0.25rem;
    gap: 0.1rem;
  }

  .details .sizes .size-marker {
    background-color: #323232;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    padding-inline: 0.5rem;
    margin-right: 0.15rem;
  }

  .custom-block {
    position: absolute;
    left: 50%;
    background: #232323;
    border: 1px solid #3aff68;
    box-shadow: greenyellow 0px 1px 5px;
    width: fit-content;
    height: fit-content;
    border-radius: 6px;
    color: #fff;
    z-index: 50;
    text-transform: uppercase;
    font-family: 'Gujarati Sangam MN';
    font-weight: 500;
    font-size: 1.5rem;
    padding: 1rem;
  }

  .autofill-btn {
    margin-left: 1rem;
    margin-right: 1rem;
    font-size: 1rem;
    background-color: #191919;
    text-transform: uppercase;

  }

  .yes {

    border: 2px solid lawngreen;
    box-shadow: lawngreen 0px 1px 5px;
  }

  .no {

    border: 2px solid red;
    box-shadow: red 0px 1px 5px;
  }

  .details .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.9rem;
    /* Slightly smaller to help fit */
    max-width: 100%;
    /* Limit width so it doesn't push layout */
  }


  .colors-group {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .color-circle {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-size: cover;
    background-position: center;
    border: 1px solid #fff;
    cursor: pointer;
  }

  #create-color {
    font-size: 0.25rem;
  }


  svg {
    object-fit: contain;
    height: 1rem;
  }
</style>
