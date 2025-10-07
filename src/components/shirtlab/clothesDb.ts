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

// Pull a clothing row + its related category/subcategory/gender labels
export async function getClothingMetaById(id: number) {
  const { data, error } = await supabase
    .from('clothing')
    .select(`
      id,
      category_code,
      subcategory_code,
      gender,
      categories:category_code (
        code, name, category
      ),
      subcategories:subcategory_code (
        code, name, category_code
      ),
      genders:gender (
        code, label
      )
    `)
    .eq('id', id)
    .single(); // or .maybeSingle() if you prefer

  if (error) throw error;
  return data;
}

// --- Direct lookup into `clothes` table by unique code ---
export interface ClothesRow {
  id: number;
  name?: string;
  // image urls
  front_url?: string | null;
  back_url?: string | null;
  image_front?: string | null; // fallback names
  image_back?: string | null;
  // grid
  grid_x?: number | null;
  grid_y?: number | null;
  grid_w?: number | null;
  grid_h?: number | null;
  print_x?: number | null; // fallbacks
  print_y?: number | null;
  print_w?: number | null;
  print_h?: number | null;
  grid_width_inches?: number | null;
  grid_width_in?: number | null;
  print_width_in?: number | null;
  print_width_inches?: number | null;
  grid_height_inches?: number | null;
  grid_height_in?: number | null;
  print_height_in?: number | null;
  print_height_inches?: number | null;
  grid_dpi?: number | null;
  print_dpi?: number | null;
  grid_ppi?: number | null;
  print_ppi?: number | null;
  // background transform
  bg_offset_x?: number | null;
  bg_offset_y?: number | null;
  bg_scale?: number | null;
  bgX?: number | null; // fallbacks
  bgY?: number | null;
  bgScale?: number | null;
}

export async function getClothesByAnyCode(code: string): Promise<ClothesRow | null> {
  // If it's a number, try id first on the legacy `clothing` table
  const maybeId = Number(code);
  if (!Number.isNaN(maybeId) && Number.isFinite(maybeId)) {
    try {
      const { data, error } = await supabase
        .from('clothing')
        .select('*')
        .eq('id', maybeId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (err: any) {
      if (err && err.code === '42P01') return null; // table missing
      if (err && err.code === '42703') { /* id column missing? */ } else if (err) { throw err; }
    }
  }

  const candidates = ['code', 'sku', 'short_code', 'slug', 'name'];
  for (const col of candidates) {
    try {
      const { data, error } = await (supabase
        .from('clothing') as any)
        .select('*')
        .eq(col, code)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (err: any) {
      if (err && err.code === '42P01') return null; // table missing -> silent
      if (err && err.code === '42703') continue; // column missing -> try next
      throw err;
    }
  }
  return null;
}

// --- clothing_items (UUID keyed) ---
export interface ClothingItemRow {
  id: string;               // uuid
  name?: string | null;
  category?: string | null;
  brand?: string | null;
  grid?: any | null;        // { x,y,w,h, bgTransform? }
  colors?: any | null;      // e.g. [{ name, frontUrl?/frontURL?/frontImage?/front?, backUrl?/backURL?/backImage?/back?, imageUrl?, bgTransform? }]
  backgrounds?: any | null; // { front?: string, back?: string }
  sizes?: any | null;
  genders?: any | null;
}

export async function getClothingItemById(id: string): Promise<ClothingItemRow | null> {
  const { data, error } = await supabase
    .from('clothing_items')
    .select('*')
    .eq('id', id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getClothingItemByAnyCode(code: string): Promise<ClothingItemRow | null> {
  const candidates = ['code', 'sku', 'short_code', 'slug', 'name'];
  for (const col of candidates) {
    try {
      const { data, error } = await (supabase
        .from('clothing_items') as any)
        .select('*')
        .eq(col as any, code)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (err: any) {
      // 42703 = undefined_column; try next candidate
      if (err && err.code === '42703') continue;
      throw err;
    }
  }
  return null;
}
