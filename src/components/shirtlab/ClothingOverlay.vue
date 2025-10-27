<template>
  <transition name="clothing-overlay-fade">
    <div v-if="show" class="clothing-overlay" role="dialog" aria-modal="true">
      <div :class="['clothing-overlay__panel', { 'clothing-overlay__panel--compact': compactPanel }]">
        <div class="clothing-overlay__filters">
          <div class="search-bar" role="search">
            <span class="search-bar__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
              </svg>
            </span>
            <input v-model="searchModel" type="search" class="search-bar__input"
              placeholder="Search by name, brand, or code" />
            <button v-if="searchModel" type="button" class="search-bar__clear" aria-label="Clear search"
              @click="clearSearch">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="m12 10.586 4.95-4.95 1.414 1.414L13.414 12l4.95 4.95-1.414 1.414L12 13.414l-4.95 4.95-1.414-1.414L10.586 12 5.636 7.05 7.05 5.636 12 10.586z" />
              </svg>
            </button>

          </div>

          <div class="filter-dropdowns">
            <div class="filter-group">
              <label class="filter-label" for="category-filter">Category</label>
              <div class="custom-dropdown" @click="toggleDropdown('category')">
                <div class="custom-dropdown__selected" :class="{ open: openDropdown === 'category' }">
                  {{ selectedCategoryLabel }}
                  <svg viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </div>
                <div class="custom-dropdown__menu" :class="{ show: openDropdown === 'category' }">
                  <div v-for="option in categoryOptions" :key="option.id"
                    :class="['custom-dropdown__option', { selected: option.id === selectedCategoryModel }]"
                    @click.stop="selectOption('category', option.id)">
                    {{ option.label }}
                  </div>
                </div>
              </div>
            </div>
            <!-- Brand filter group -->
            <div class="filter-group">
              <label class="filter-label" for="brand-filter">Brand</label>
              <div class="custom-dropdown" @click="toggleDropdown('brand')">
                <div class="custom-dropdown__selected" :class="{ open: openDropdown === 'brand' }">
                  {{ selectedBrandLabel }}
                  <svg viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </div>
                <div class="custom-dropdown__menu" :class="{ show: openDropdown === 'brand' }">
                  <div v-for="option in brandOptions" :key="option.id"
                    :class="['custom-dropdown__option', { selected: option.id === selectedBrandModel }]"
                    @click.stop="selectOption('brand', option.id)">
                    {{ option.label }}
                  </div>
                </div>
              </div>
            </div>
            <div v-if="subcategoryOptions.length > 1" class="filter-group">
              <label class="filter-label" for="subcategory-filter">Subcategory</label>
              <div class="custom-dropdown" @click="toggleDropdown('subcategory')">
                <div class="custom-dropdown__selected" :class="{ open: openDropdown === 'subcategory' }">
                  {{ selectedSubcategoryLabel }}
                  <svg viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </div>
                <div class="custom-dropdown__menu" :class="{ show: openDropdown === 'subcategory' }">
                  <div v-for="option in subcategoryOptions" :key="option.id"
                    :class="['custom-dropdown__option', { selected: option.id === selectedSubcategoryModel }]"
                    @click.stop="selectOption('subcategory', option.id)">
                    {{ option.label }}
                  </div>
                </div>
              </div>
            </div>
            <div class="filter-group">
              <label class="filter-label" for="gender-filter">Gender</label>
              <div class="custom-dropdown" @click="toggleDropdown('gender')">
                <div class="custom-dropdown__selected" :class="{ open: openDropdown === 'gender' }">
                  {{ selectedGenderLabel }}
                  <svg viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </div>
                <div class="custom-dropdown__menu" :class="{ show: openDropdown === 'gender' }">
                  <div v-for="option in genderOptions" :key="option.id"
                    :class="['custom-dropdown__option', { selected: option.id === selectedGenderModel }]"
                    @click.stop="selectOption('gender', option.id)">
                    {{ option.label }}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
        <div class="clothing-overlay__body">
          <div v-if="overlayLoading" class="status">Loading styles…</div>
          <div v-else-if="overlayError" class="status error">{{ overlayError }}</div>
          <div v-else-if="filteredClothing.length === 0" class="status">No styles match your filters.</div>
          <div v-else :class="['clothing-grid', { 'clothing-grid--pair': filteredClothing.length <= 2 }]">
            <button v-for="item in filteredClothing" :key="item.id" type="button"
              :class="['clothing-card', { selected: String(item.id ?? '') === activeItemId }]"
              @click="handleApply(item)">
              <div class="clothing-card__preview">
                <img :src="hoverPreview[item.id] || resolvePreview(item) || overlayFallbackPreview"
                  :alt="item.name || 'Garment preview'" />
              </div>
              <div class="clothing-card-colors__meta">
                <div v-if="item.colors && Array.isArray(item.colors)" class="color-swatches">
                  <div v-for="(color, index) in visibleColors(item.colors)" :key="index" class="color-swatch"
                    :style="{ backgroundColor: color.hex || color.rgb || color.colorCode || '#ccc' }"
                    @mouseenter="hoverColor(item, color)" @mouseleave="resetPreview(item)">
                    <span v-if="color.moreCount" class="color-more">+{{ color.moreCount }}</span>
                  </div>
                </div>
              </div>
              <div class="clothing-card__meta">
                <h3>{{ item.name || 'Unnamed Style' }}</h3>
                <p>{{ formatClothingMeta(item) }}</p>
              </div>

            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { ClothingItemRow } from './clothesDb';
  // --- Color swatch preview logic ---
  const hoverPreview = ref<Record<string, string>>({});

  function hoverColor(item: ClothingItemRow, color: any) {
    const front = color.frontUrl || color.frontImage || color.front || color.imageUrl;
    if (front) hoverPreview.value[item.id] = front;
  }

  function resetPreview(item: ClothingItemRow) {
    delete hoverPreview.value[item.id];
  }

  function visibleColors(colors: any[]) {
    const maxVisible = 14;
    if (colors.length <= maxVisible) return colors;
    const visible = colors.slice(0, maxVisible - 1);
    visible.push({ moreCount: colors.length - (maxVisible - 1) });
    return visible;
  }

  export interface Option {
    id: string;
    label: string;
  }

  export interface ClothingOverlayProps {
    show: boolean;
    search: string;
    categoryOptions: Option[];
    selectedCategory: string;
    subcategoryOptions: Option[];
    selectedSubcategory: string;
    selectedGender: string;
    brandOptions: Option[];
    selectedBrand: string;
    overlayLoading: boolean;
    overlayError: string;
    filteredClothing: ClothingItemRow[];
    activeItemId: string | null;
    overlayFallbackPreview: string;
    resolvePreview: (item: ClothingItemRow) => string | undefined;
    formatClothingMeta: (item: ClothingItemRow) => string;
  }

  const props = defineProps<ClothingOverlayProps>();

  const emit = defineEmits<{
    (e: 'update:search', value: string): void;
    (e: 'update:selectedCategory', value: string): void;
    (e: 'update:selectedSubcategory', value: string): void;
    (e: 'update:selectedGender', value: string): void;
    (e: 'update:selectedBrand', value: string): void;
    (e: 'apply', item: ClothingItemRow): void;
  }>();

  const searchModel = computed({
    get: () => props.search,
    set: (value: string) => emit('update:search', value),
  });

  const selectedCategoryModel = computed({
    get: () => props.selectedCategory,
    set: (value: string) => emit('update:selectedCategory', value),
  });

  const selectedSubcategoryModel = computed({
    get: () => props.selectedSubcategory,
    set: (value: string) => emit('update:selectedSubcategory', value),
  });

  const selectedGenderModel = computed({
    get: () => props.selectedGender,
    set: (value: string) => emit('update:selectedGender', value),
  });

  const selectedBrandModel = computed({
    get: () => props.selectedBrand,
    set: (value: string) => emit('update:selectedBrand', value),
  });

  function clearSearch() {
    searchModel.value = '';
  }

  function handleApply(item: ClothingItemRow) {
    emit('apply', item);
  }

  // --- Custom dropdown logic ---
  const openDropdown = ref<string | null>(null);

  function toggleDropdown(type: string) {
    if (['category', 'subcategory', 'gender', 'brand'].includes(type)) {
      openDropdown.value = openDropdown.value === type ? null : type;
    }
  }

  function selectOption(type: string, value: string) {
    if (type === 'category') selectedCategoryModel.value = value;
    if (type === 'subcategory') selectedSubcategoryModel.value = value;
    if (type === 'gender') selectedGenderModel.value = value;
    if (type === 'brand') selectedBrandModel.value = value;
    openDropdown.value = null;
  }

  const selectedCategoryLabel = computed(() =>
    props.categoryOptions.find(opt => opt.id === props.selectedCategory)?.label || 'All'
  );
  const selectedSubcategoryLabel = computed(() =>
    props.subcategoryOptions.find(opt => opt.id === props.selectedSubcategory)?.label || 'All'
  );
  const selectedBrandLabel = computed(() =>
    props.brandOptions.find(opt => opt.id === props.selectedBrand)?.label || 'All'
  );
  const genderOptions: Option[] = [
    { id: 'all', label: 'All' },
    { id: 'women', label: 'Women' },
    { id: 'unisex', label: 'Unisex' },
  ];
  const selectedGenderLabel = computed(() =>
    genderOptions.find(opt => opt.id === props.selectedGender)?.label || 'All'
  );

  const compactPanel = computed(() => props.filteredClothing.length > 0 && props.filteredClothing.length <= 4);
</script>

<style scoped lang="scss">
  .clothing-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;

    background: #fff;
    z-index: 5000;
    transition: all 0.2s ease;

  }

  .clothing-overlay__panel {
    background: #fff;
    width: min(1200px, 100%);
    max-width: min(1200px, 100%);
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 2rem;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .clothing-overlay__panel--compact {
    width: auto;
    max-width: min(920px, 100%);
  }


  .clothing-overlay__filters {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    background: linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.85));
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    box-sizing: border-box;
    padding: 0.7rem 1.1rem;
    flex-wrap: wrap;


    border-bottom: 1px solid rgba(148, 163, 184, 0.25);


  }

  .search-bar__icon {
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 1.1rem;
      height: 1.1rem;
      fill: #475569;
    }
  }

  .search-bar__input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.95rem;
    color: #0f172a;
    padding: 0;

    &:focus {
      outline: none;
    }
  }

  .search-bar__clear {
    border: none;
    background: rgba(148, 163, 184, 0.18);
    border-radius: 9999px;
    padding: 0.3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.18s ease;

    &:hover {
      background: rgba(148, 163, 184, 0.28);
    }

    svg {
      width: 1rem;
      height: 1rem;
      fill: #475569;
    }
  }

  .filter-dropdowns {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 0.9rem;
    flex-wrap: wrap;

  }

  .filter-group {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1 1 220px;
    min-width: 200px;
  }

  .filter-label {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
    text-align: left;
    padding-left: 0.25rem;
  }

  .custom-dropdown {
    position: relative;
    width: 100%;
    user-select: none;
  }

  .custom-dropdown__selected {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(226, 232, 240, 0.8));
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 0.8rem;
    padding: 0.25rem 1rem 0.25rem 1rem;
    font-size: 0.95rem;
    color: #0f172a;
    cursor: pointer;
    display: flex;
    gap: 2rem;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
    transition: all 0.2s ease;

    &:hover {
      border-color: #94a3b8;
    }

    svg {
      width: 1rem;
      height: 1rem;
      fill: #475569;
      transition: transform 0.2s ease;
    }

    &.open svg {
      transform: rotate(180deg);
    }
  }

  .custom-dropdown__menu {
    position: absolute;
    display: flex;
    flex-direction: column;
    top: calc(100% + 0.3rem);
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 0.8rem;
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.18);
    max-height: 12rem;
    overflow-y: auto;
    width: max-content;
    z-index: 10;
    opacity: 0;
    transform: translateY(-5px);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;


    &.show {
      opacity: 1;
      transform: translateY(0);
      pointer-events: all;
    }

    .custom-dropdown__option {
      padding: 0.25rem 1rem 0.25rem 1rem;
      font-size: 0.95rem;
      color: #0f172a;
      cursor: pointer;
      transition: background 0.15s ease;
      text-align: left;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);



      &:hover {
        background: rgba(226, 232, 240, 0.4);
      }

      &.selected {
        background: rgba(100, 116, 139, 0.1);
        font-weight: 500;
      }
    }
  }

  @media (max-width: 900px) {
    .filter-group {
      flex: 1 1 45%;
      min-width: 0;
    }
  }

  @media (max-width: 720px) {
    .filter-dropdowns {
      flex-direction: column;
      padding: 0.5rem 0.9rem;
    }

    .filter-group {
      flex: 1 1 100%;
    }
  }

  .clothing-overlay__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .status {
    margin: auto;
    font-size: 1rem;
    color: #475569;

    &.error {
      color: #b91c1c;
    }
  }

  .clothing-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    overflow-y: auto;
    padding-right: 0.25rem;
    padding-top: 0.25rem;
  }

  .clothing-grid--pair {
    display: flex;
  }

  .clothing-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    width: minmax(200px, 1fr);

    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: #f8fafc;
    text-align: left;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
      border-color: rgba(15, 23, 42, 0.15);
      background: #fff;
    }

    &.selected {
      border-color: rgba(15, 118, 110, 0.6);
      box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.25);
      background: #ecfeff;
    }

    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.85rem;
    }
  }

  .clothing-card__preview {
    background: #fff;
    border-radius: 0.9rem;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.25);

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .clothing-overlay-fade-enter-active,
  .clothing-overlay-fade-leave-active {
    transition: opacity 0.22s ease;
  }

  .clothing-overlay-fade-enter-from,
  .clothing-overlay-fade-leave-to {
    opacity: 0;
  }

  @media (max-width: 960px) {
    .clothing-overlay {
      padding: 1rem;
    }

    .clothing-overlay__panel {
      padding: 1.5rem;
      width: 100%;
      max-width: 100%;
    }

    .clothing-overlay__panel--compact {
      width: 100%;
      max-width: 100%;
    }

    .clothing-grid {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .clothing-grid--pair {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      justify-content: center;
    }
  }


  .clothing-card-colors__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;

  }

  .color-swatches {
    display: flex;
    flex-wrap: wrap;

  }

  .color-swatch {
    width: 1.5rem;
    height: 1rem;

    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    position: relative;
    overflow: hidden;

    &:hover {
      transform: scale(1.15);
      transition: transform 0.15s ease;
    }
  }

  .color-swatch:last-of-type {
    border-color: rgba(255, 255, 255, 0.75);
  }

  .color-more {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 500;
    color: #0f172a;
    background: rgba(255, 255, 255, 0.75);
    border-color: rgba(255, 255, 255, 0.75);

  }
</style>
