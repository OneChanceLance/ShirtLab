<template>
  <div class="admin-overlay" role="dialog" aria-modal="true">
    <div class="admin-panel">
      <header class="admin-header">
        <h2>Admin Dashboard</h2>
        <div class="admin-header__actions">
          <button type="button" class="outline" @click="refreshList" :disabled="listLoading">
            {{ listLoading ? 'Refreshing…' : 'Refresh' }}
          </button>
          <button type="button" class="ghost" @click="$emit('close')">Close</button>
        </div>
      </header>

      <section class="admin-section">
        <h3>Import Clothing Item</h3>
        <p class="hint">Fetch a style from S&amp;S and store it in Supabase for future use.</p>
        <form class="import-form" @submit.prevent="handleImport">
          <input v-model="styleInput" type="text" placeholder="Enter style / product ID" :disabled="importing"
            autocomplete="off" />
          <button type="submit" :disabled="importing">
            {{ importing ? 'Importing…' : 'Import' }}
          </button>
        </form>
        <p v-if="importError" class="status error">{{ importError }}</p>
        <p v-else-if="importSuccess" class="status success">{{ importSuccess }}</p>
      </section>

      <section class="admin-section">
        <div class="list-toolbar">
          <div>
            <h3>Stored Styles</h3>
            <p class="hint" v-if="items.length">{{ items.length }} stored</p>
          </div>
          <input v-model="searchTerm" type="search" placeholder="Filter by code, name, or brand" />
        </div>

        <div v-if="listError" class="status error">{{ listError }}</div>
        <div v-else-if="listLoading" class="status">Loading clothing items…</div>
        <div v-else-if="filteredItems.length === 0" class="status">No clothing items found.</div>
        <table v-else class="items-table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Name</th>
              <th scope="col">Brand</th>
              <th scope="col">Colors</th>
              <th scope="col">Updated</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id">
              <td>{{ item.code || item.sku || '—' }}</td>
              <td>{{ item.name || 'Unnamed Style' }}</td>
              <td>{{ item.brand || '—' }}</td>
              <td>{{ Array.isArray(item.colors) ? item.colors.length : 0 }}</td>
              <td>{{ formatTimestamp(item.updated_at || item.created_at) }}</td>
              <td class="actions">
                <button type="button" @click="applyClothing(item)">Apply</button>
                <button type="button" class="secondary" @click="updateClothing(item)"
                  :disabled="updatingId === clothingRowKey(item) || !resolveIdentifier(item) || importing">
                  {{ updatingId === clothingRowKey(item) ? 'Updating…' : 'Update' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="updateError" class="status error status--compact">{{ updateError }}</p>
        <p v-else-if="updateSuccess" class="status success status--compact">{{ updateSuccess }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { supabase } from '../../supabase';
  import { extractSizeMeasurementsFromPromo } from '../../utils/sizeMeasurements';

  type ClothingRecord = Record<string, any> & {
    id?: string;
    code?: string | null;
    sku?: string | null;
    slug?: string | null;
    short_code?: string | null;
    name?: string | null;
    brand?: string | null;
    colors?: any;
    grid?: any;
    backgrounds?: any;
    default_color_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'apply', payload: ClothingRecord): void;
  }>();

  const styleInput = ref('');
  const importing = ref(false);
  const importError = ref('');
  const importSuccess = ref('');
  const updatingId = ref<string | null>(null);
  const updateError = ref('');
  const updateSuccess = ref('');

  const items = ref<ClothingRecord[]>([]);
  const listLoading = ref(false);
  const listError = ref('');
  const searchTerm = ref('');

  const filteredItems = computed(() => {
    const query = searchTerm.value.trim().toLowerCase();
    if (!query) return items.value;
    return items.value.filter((item) => {
      const fields = [item.code, item.sku, item.name, item.brand];
      return fields.some((val) => typeof val === 'string' && val.toLowerCase().includes(query));
    });
  });

  const MISSING_TABLE_MESSAGE = 'Supabase table `clothing_items` is missing. Create it or run the latest migration before using the admin dashboard.';

  function isMissingRelation(err: any) {
    return err?.code === '42P01';
  }

  function deriveSideUrl(url?: string | null): string | null {
    if (!url) return null;
    const replacements: Array<[RegExp, string]> = [
      [/_f_/i, '_d_'],
      [/_f_/i, '_sd_'],
      [/front/gi, 'side'],
      [/back/gi, 'side'],
      [/_b_/i, '_d_'],
      [/_b_/i, '_sd_'],
    ];
    for (const [pattern, replacement] of replacements) {
      if (pattern.test(url)) {
        const candidate = url.replace(pattern, replacement);
        if (candidate !== url) return candidate;
      }
    }
    return null;
  }

  function resolveSideFromColor(color: any, front?: string | null, back?: string | null): string | null {
    if (!color || typeof color !== 'object') {
      return deriveSideUrl(front) ?? deriveSideUrl(back);
    }
    const media = Array.isArray(color.media) ? color.media : [];
    const candidates: Array<string | null | undefined> = [
      color.sideUrl,
      color.sideURL,
      color.sideImage,
      color.side,
      color.sleeveUrl,
      color.sleeve,
      media.find((item: any) =>
        /side|profile|left|right/i.test(item?.classType ?? item?.location ?? item?.description ?? '')
      )?.url,
      media.find((item: any) => typeof item?.url === 'string' && /_(sd|d|s)_/i.test(item.url))?.url,
      deriveSideUrl(front),
      deriveSideUrl(back),
    ];
    const picked = candidates.find((value) => typeof value === 'string' && value.trim());
    return picked ? String(picked) : null;
  }

  onMounted(() => {
    refreshList();
  });

  function formatTimestamp(value: string | null | undefined) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return value;
    }
  }

  async function refreshList() {
    listLoading.value = true;
    listError.value = '';
    try {
      const { data, error } = await supabase
        .from('clothing_items')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      items.value = Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.error('[AdminDashboard] Failed to load clothing items', err);
      if (isMissingRelation(err)) {
        listError.value = MISSING_TABLE_MESSAGE;
      } else {
        listError.value = err?.message || 'Unable to load clothing items.';
      }
      items.value = [];
    } finally {
      listLoading.value = false;
    }
  }

  async function upsertClothingFromPromo(code: string): Promise<ClothingRecord> {
    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promostandards-product`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ productId: code }),
    });

    if (!res.ok) {
      const details = await res.json().catch(() => ({}));
      throw new Error(details.error || 'Failed to fetch style from PromoStandards.');
    }

    const payload = await res.json();
    const raw = payload?.raw;
    const product = payload?.product;
    if (!product || !Array.isArray(product.colors) || product.colors.length === 0) {
      throw new Error('No colors returned for that style.');
    }

    const normalizedColors = (product.colors ?? []).map((color: any) => {
      if (!color || typeof color !== 'object') return color;
      const front = color.frontUrl ?? color.front ?? null;
      const back = color.backUrl ?? color.back ?? null;
      const side = resolveSideFromColor(color, front, back);
      if (side && !color.sideUrl) {
        return { ...color, sideUrl: side };
      }
      return color;
    });
    product.colors = normalizedColors as any;

    const defaultColor = product.colors.find((c: any) => c.id === product.defaultColorId) || product.colors[0];
    const sizeMeasurements = extractSizeMeasurementsFromPromo(raw?.Product);
    const grid = {
      x: 175,
      y: 150,
      w: 250,
      h: 400,
      widthInches: 12,
      heightInches: 18,
      auto: true,
    };

    const rawProduct = (raw as Record<string, any> | undefined)?.Product;
    const detectedBrand = (rawProduct as Record<string, any> | undefined)?.productBrand
      ?? product?.brand
      ?? null;

    const frontCandidate = defaultColor?.frontUrl ?? defaultColor?.front ?? null;
    const backCandidate = defaultColor?.backUrl ?? defaultColor?.back ?? null;
    const resolvedSide = resolveSideFromColor(defaultColor, frontCandidate, backCandidate);

    const record: ClothingRecord = {
      code,
      name: product.name ?? code,
      brand: detectedBrand,
      colors: product.colors,
      grid,
      backgrounds: {
        front: defaultColor?.frontUrl ?? null,
        side: resolvedSide ?? null,
        back: defaultColor?.backUrl ?? null,
      },
      default_color_id: product.defaultColorId ?? null,
      updated_at: new Date().toISOString(),
    };
    if (resolvedSide && defaultColor && !defaultColor.sideUrl) {
      defaultColor.sideUrl = resolvedSide;
    }

    if (sizeMeasurements.length) {
      (record as any).size_measurements = sizeMeasurements;
    }

    try {
      const existingId = await lookupExistingClothingId(code);
      if (existingId) record.id = existingId;
    } catch (lookupError: any) {
      if (isMissingRelation(lookupError)) {
        throw Object.assign(new Error(MISSING_TABLE_MESSAGE), { code: lookupError.code });
      }
      throw lookupError;
    }

    let attempt = { ...record } as ClothingRecord;
    const pruned = new Set<string>();

    while (true) {
      const { error: upsertError } = await supabase.from('clothing_items').upsert(attempt);
      if (!upsertError) break;
      if (isMissingRelation(upsertError)) {
        throw Object.assign(new Error(MISSING_TABLE_MESSAGE), { code: upsertError.code });
      }
      if (upsertError.code !== '42703') throw upsertError;
      const missing = extractMissingColumn(upsertError.message);
      if (!missing || pruned.has(missing)) throw upsertError;
      pruned.add(missing);
      delete attempt[missing];
    }

    return record;
  }

  function resolveIdentifier(item: ClothingRecord): string {
    const candidates = [item.code, item.sku, item.slug, item.short_code, item.name];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  }

  function clothingRowKey(item: ClothingRecord): string {
    const identifier = resolveIdentifier(item);
    if (typeof item.id === 'string' && item.id.trim()) return item.id;
    return identifier;
  }

  async function handleImport() {
    const code = styleInput.value.trim();
    if (!code) {
      importError.value = 'Enter a style or product identifier.';
      return;
    }

    importing.value = true;
    importError.value = '';
    importSuccess.value = '';
    updateError.value = '';
    updateSuccess.value = '';

    try {
      const record = await upsertClothingFromPromo(code);
      importSuccess.value = `Stored ${record.name ?? code} (${code}).`;
      styleInput.value = '';
      await refreshList();
    } catch (err: any) {
      console.error('[AdminDashboard] Import failed', err);
      importError.value = err?.message || 'Unable to import clothing item.';
    } finally {
      importing.value = false;
    }
  }

  async function updateClothing(item: ClothingRecord) {
    updateError.value = '';
    updateSuccess.value = '';

    const identifier = resolveIdentifier(item);
    if (!identifier) {
      updateError.value = 'Unable to update this style because it is missing a code or SKU.';
      return;
    }

    const rowKey = clothingRowKey(item);
    updatingId.value = rowKey || identifier;

    try {
      const record = await upsertClothingFromPromo(identifier);
      updateSuccess.value = `Updated ${record.name ?? identifier}.`;
      await refreshList();
    } catch (err: any) {
      console.error('[AdminDashboard] Update failed', err);
      updateError.value = err?.message || 'Unable to update clothing item.';
    } finally {
      updatingId.value = null;
    }
  }

  async function lookupExistingClothingId(code: string) {
    const identifiers = ['code', 'sku', 'slug', 'short_code', 'name'];
    for (let i = 0; i < identifiers.length; i++) {
      const column: string = identifiers[i];
      const { data, error } = await supabase
        .from('clothing_items')
        .select('id')
        .eq(column, code)
        .maybeSingle();

      if (error) {
        // Undefined column — try next identifier
        if (error.code === '42703') continue;
        if (isMissingRelation(error)) throw error;
        throw error;
      }

      if (data?.id) return data.id as string;
    }
    return null;
  }

  function applyClothing(item: ClothingRecord) {
    emit('apply', item);
  }

  function extractMissingColumn(message?: string | null) {
    if (!message) return null;
    const match = message.match(/column "([^"]+)"/i);
    return match ? match[1] : null;
  }

</script>

<style scoped>
  .admin-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    z-index: 5000;
  }

  .admin-panel {
    width: min(900px, 95vw);
    max-height: 90vh;
    overflow: auto;
    background: #f8fafc;
    border-radius: 1rem;
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.45);
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: 'Anek Latin', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .admin-header h2 {
    margin: 0;
    font-size: 1.6rem;
    color: #0f172a;
  }

  .admin-header__actions {
    display: flex;
    gap: 0.75rem;
  }

  .admin-section {
    background: rgba(255, 255, 255, 0.85);
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .admin-section h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #111827;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: #475569;
  }

  .import-form {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  input[type='text'],
  input[type='search'] {
    flex: 1;
    min-width: 12rem;
    padding: 0.55rem 0.75rem;
    border-radius: 0.6rem;
    border: 1px solid #cbd5f5;
    background: #fff;
    font-size: 0.95rem;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.07);
    color: #0f172a;
  }

  button {
    border: none;
    border-radius: 0.6rem;
    padding: 0.55rem 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    background: linear-gradient(135deg, #94c940, #79b22d);
    color: #0f172a;
  }

  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(148, 201, 64, 0.35);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: none;
  }

  button.ghost {
    background: transparent;
    color: #1e293b;
    border: 1px solid rgba(30, 41, 59, 0.35);
  }

  button.ghost:hover {
    background: rgba(30, 41, 59, 0.06);
    box-shadow: none;
  }

  button.outline {
    background: transparent;
    color: #0f172a;
    border: 1px solid rgba(79, 70, 229, 0.35);
  }

  button.outline:hover {
    background: rgba(79, 70, 229, 0.08);
    box-shadow: none;
  }

  button.secondary {
    background: transparent;
    color: #0f172a;
    border: 1px solid rgba(148, 201, 64, 0.55);
  }

  button.secondary:hover {
    background: rgba(148, 201, 64, 0.12);
    box-shadow: none;
  }

  .status {
    font-size: 0.9rem;
    color: #1f2937;
  }

  .status.error {
    color: #b91c1c;
  }

  .status.success {
    color: #15803d;
  }

  .list-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .list-toolbar input[type='search'] {
    max-width: 18rem;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
    overflow: hidden;
    border-radius: 0.6rem;
  }

  .items-table thead {
    background: #e2e8f0;
    color: #0f172a;
  }

  .items-table th,
  .items-table td {
    padding: 0.65rem 0.8rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .items-table tbody tr:hover {
    background: rgba(148, 201, 64, 0.08);
  }

  .items-table .actions {
    text-align: right;
  }

  .items-table .actions button {
    padding: 0.4rem 0.85rem;
    font-size: 0.85rem;
  }

  .items-table .actions button+button {
    margin-left: 0.5rem;
  }

  .status--compact {
    margin-top: 0.5rem;
  }

  @media (max-width: 768px) {
    .admin-panel {
      padding: 1rem 1.25rem;
    }

    .items-table {
      display: block;
      overflow-x: auto;
    }
  }
</style>
