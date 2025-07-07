import { defineStore } from 'pinia';

export const useClothingStore = defineStore('clothingStore', {
  state: () => ({
    newClothingItem: null as null | {
      name: string,
      category: string,
      sizes: string[],
      genders: string[],
      image: File | null
    },
    isCreating: false
  }),
  actions: {
    createClothing(item: {
      name: string,
      category: string,
      sizes: string[],
      genders: string[],
      image: File | null
    }) {
      this.newClothingItem = item;
    },
    setIsCreating(value: boolean) {
      this.isCreating = value;
    }
  }
});