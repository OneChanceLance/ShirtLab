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
              </td>
            </tr>
          </tbody>
        </table>
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
        .order('updated_at', { ascending: false, nullsLast: false })
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

  async function handleImport() {
    const code = styleInput.value.trim();
    if (!code) {
      importError.value = 'Enter a style or product identifier.';
      return;
    }

    importing.value = true;
    importError.value = '';
    importSuccess.value = '';

    try {
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
      const raw = payload?.raw
      const product = payload?.product;
      if (!product || !Array.isArray(product.colors) || product.colors.length === 0) {
        throw new Error('No colors returned for that style.');
      }

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

      const detectedBrand = (raw.Product?.productBrand)
        || (ssactivewearBrand.value && ssactivewearBrand.value.trim())
        || (selectedBrand.value && selectedBrand.value.trim())
        || null;

      const record: ClothingRecord = {
        code,
        name: product.name ?? code,
        brand: detectedBrand,
        colors: product.colors,
        grid,
        backgrounds: {
          front: defaultColor?.frontUrl ?? null,
          back: defaultColor?.backUrl ?? null,
        },
        default_color_id: product.defaultColorId ?? null,
        updated_at: new Date().toISOString(),
      };

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

      importSuccess.value = `Stored ${record.name} (${code}).`;
      styleInput.value = '';
      await refreshList();
    } catch (err: any) {
      console.error('[AdminDashboard] Import failed', err);
      importError.value = err?.message || 'Unable to import clothing item.';
    } finally {
      importing.value = false;
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
