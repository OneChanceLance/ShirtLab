import { defineStore } from "pinia";

export const useClothingStore = defineStore("clothingStore", {
  state: () => ({
    newClothingItem: null as null | {
      name: string;
      category: string;
      sizes: string[];
      genders: string[];
      grid?: any;
      brand: string;
      colors: { name: string; colorBackground: string; colorStyleID: string; background: string }[];
    },
    isCreating: false,
    currentGrid: null as null | any,
  }),
  actions: {
    createClothing(item: {
      name: string;
      category: string;
      sizes: string[];
      genders: string[];
      grid?: any;
      brand: string;
      colors: { name: string; colorBackground: string; colorStyleID: string; background: string }[];
    }) {
      this.newClothingItem = item;
      this.currentGrid = item.grid ?? null;
    },
    setIsCreating(value: boolean) {
      this.isCreating = value;
    },
    setCurrentGrid(grid) {
      this.currentGrid = grid;
    },
  },
});
