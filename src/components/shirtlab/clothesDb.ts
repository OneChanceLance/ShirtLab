// src/components/shirtlab/clothesDb.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Type definitions
export interface ClothingCategory {
  code: string;
  name: string;
  category: string;
}

export interface Subcategory {
  code: string;
  category_code: string;
  name: string;
}

export interface Gender {
  code: string; // 'm' or 'w'
  label: string;
}

export interface ClothingItem {
  id: number;
  category_code: string;
  subcategory_code: string;
  gender: string;
  brand: string;
  name: string;
  colors: Array<{
    name: string;
    imageUrl: string; // this is your `imageUrl`

  }>;
}

export interface Material {
  code: string;
  name: string;
}

export interface ClothingItemMaterial {
  clothing_item_id: number;
  material_code: string;
  percentage: number;
}

// Dynamic fetchers
export async function getCategories(): Promise<ClothingCategory[]> {
  const { data, error } = await supabase.from('categories').select('*');
  if (error) throw error;
  return data;
}

export async function getSubcategories(): Promise<Subcategory[]> {
  const { data, error } = await supabase.from('subcategories').select('*');
  if (error) throw error;
  return data;
}

export async function getGenders(): Promise<Gender[]> {
  const { data, error } = await supabase.from('genders').select('*');
  if (error) throw error;
  return data;
}

export async function getClothingItems(): Promise<ClothingItem[]> {
  const { data, error } = await supabase.from('clothing').select('*');
  if (error) throw error;
  return data;
}

export async function getMaterials(): Promise<Material[]> {
  const { data, error } = await supabase.from('materials').select('*');
  if (error) throw error;
  return data;
}

export async function getItemMaterials(itemId: number): Promise<ClothingItemMaterial[]> {
  const { data, error } = await supabase
    .from('clothing_item_materials')
    .select('*')
    .eq('clothing_item_id', itemId);
  if (error) throw error;
  return data;
}

// CRUD functions for clothing items
export async function addClothingItem(item: Omit<ClothingItem, 'id'>): Promise<ClothingItem> {
  const { data, error } = await supabase.from('clothing').insert(item).select().single();
  if (error) throw error;
  return data;
}

export async function updateClothingItem(id: number, updates: Partial<ClothingItem>): Promise<ClothingItem> {
  const { data, error } = await supabase.from('clothing').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClothingItem(id: number): Promise<void> {
  const { error } = await supabase.from('clothing').delete().eq('id', id);
  if (error) throw error;
}