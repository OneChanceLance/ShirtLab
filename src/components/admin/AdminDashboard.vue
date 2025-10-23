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
          <button type="button" class="secondary" @click="updateAllClothing" :disabled="updateAllBusy || !items.length">
            {{ updateAllBusy ? 'Updating All…' : 'Update All' }}
          </button>
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
  const updateAllBusy = ref(false);

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

  interface CategoryGuess {
    category: string | null;
    subcategory: string | null;
  }

  function classifyProductCategory(product: any, rawProduct: any): CategoryGuess {
    const segments = new Set<string>();

    const collect = (value: unknown) => {
      if (!value) return;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) segments.add(trimmed);
        return;
      }
      if (Array.isArray(value)) {
        for (const entry of value) collect(entry);
        return;
      }
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keysOfInterest = [
          'name',
          'Name',
          'description',
          'Description',
          'productName',
          'ProductName',
          'productType',
          'ProductType',
          'productCategory',
          'ProductCategory',
          'productSubCategory',
          'ProductSubCategory',
          'category',
          'Category',
          'label',
          'Label',
          'title',
          'Title',
          'keywords',
          'Keywords',
          'type',
          'Type',
          'group',
          'Group',
        ];
        for (const key of keysOfInterest) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            collect(obj[key]);
          }
        }
      }
    };

    collect(product?.name);
    collect(product?.description);
    collect((product as Record<string, any> | undefined)?.productType ?? (product as any)?.type ?? null);
    collect((product as Record<string, any> | undefined)?.productCategory ?? (product as any)?.category ?? null);
    collect((product as Record<string, any> | undefined)?.productSubCategory ?? null);
    collect((rawProduct as Record<string, any> | undefined)?.ProductMarketing ?? (rawProduct as any)?.productMarketing);
    collect(rawProduct?.Product ?? rawProduct?.product ?? rawProduct);
    collect(rawProduct?.ProductCategoryArray ?? rawProduct?.productCategoryArray);
    collect(rawProduct?.Classification ?? rawProduct?.classification);

    const combined = Array.from(segments).join(' ').toLowerCase();
    const normalized = combined.replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalized) {
      return { category: '1', subcategory: '1a' };
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const tokenSet = new Set(tokens);
    const padded = ` ${normalized} `;

    const hasToken = (...candidates: string[]) => {
      return candidates.some((candidate) => {
        const base = candidate.toLowerCase();
        return tokenSet.has(base)
          || tokenSet.has(`${base}s`)
          || tokenSet.has(`${base}es`)
          || tokenSet.has(base.replace(/s$/, ''));
      });
    };

    const hasPhrase = (...phraseTokens: string[]) => {
      if (!phraseTokens.length) return false;
      for (let i = 0; i <= tokens.length - phraseTokens.length; i += 1) {
        let matches = true;
        for (let j = 0; j < phraseTokens.length; j += 1) {
          if (tokens[i + j] !== phraseTokens[j]) {
            matches = false;
            break;
          }
        }
        if (matches) return true;
      }
      return false;
    };

    const matches = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(padded));



    let category: string = '1';
    let subcategory: string | null = '1a';

    const mentionsCrewneck = hasToken('crewneck') || hasPhrase('crew');
    const mentionsFleece = hasToken('fleece');
    const isSweatshirt = hasToken('sweatshirt');
    const isSweater = hasToken('sweater');
    const isHoodie = matches(/\bhood(ie|ed|s)?\b/) || hasToken('hoodie', 'hooded');
    const isPullover = hasToken('pullover');
    const isJacket = hasToken('jacket', 'anorak', 'parka', 'windbreaker', 'coat', 'shell');
    const isOuterwear = hasToken('outerwear');
    const mentionsQuarterZip = matches(/\bquarter zip\b/) || matches(/\b1 4 zip\b/) || matches(/\b1\/4 zip\b/);
    const mentionsHalfZip = matches(/\bhalf zip\b/) || matches(/\b1 2 zip\b/) || matches(/\b1\/2 zip\b/);
    const mentionsZip = matches(/\bzip(per|ped)?\b/) || hasToken('zipup', 'zipfront', 'zipper', 'zip') || matches(/\bzip-up\b/);
    const isFleece =
      isSweatshirt ||
      mentionsFleece ||
      isSweater ||
      isHoodie ||
      isPullover ||
      isJacket ||
      isOuterwear ||
      ((mentionsQuarterZip || mentionsHalfZip || mentionsZip) && (isSweatshirt || isHoodie || isJacket || mentionsFleece)) ||
      (mentionsCrewneck && (isSweatshirt || mentionsFleece));
    if (isFleece) {
      category = '2';
      if (mentionsZip || mentionsQuarterZip || mentionsHalfZip) {
        subcategory = '2c';
      } else if (isHoodie) {
        subcategory = '2b';
      } else {
        subcategory = '2a';
      }
      return { category, subcategory };
    }

    const resolveShirtCategory = () => {
      const category = '1';
      const isOnesie = hasToken('onesie', 'onesy', 'bodysuit', 'romper', 'infant', 'baby');
      if (isOnesie) return { category, subcategory: '1d' };

      const isPolo = hasToken('polo', 'golf') || hasPhrase('polo', 'golf');
      if (isPolo) return { category, subcategory: '1c' };

      const isLongSleeve = hasPhrase('long', 'sleeve') || hasToken('longsleeve', 'longsleeved', 'ls');
      if (isLongSleeve) return { category, subcategory: '1b' };

      const isShortSleeve = hasPhrase('short', 't-shirt', 'tee') || hasToken('shortsleeve', 'shortsleeved');
      const mentionsTee = hasToken('tee', 'tshirt', 't-shirt', 'crewneck', 'jersey', 'vneck', 'v-neck')
        || hasPhrase('t', 'shirt')
        || hasPhrase('v', 'neck');
      if (isShortSleeve || mentionsTee || hasToken('tank', 'tanktop', 'muscle')) {
        return { category, subcategory: '1a' };
      }

      return null;
    };

    const shirtResult = resolveShirtCategory();
    if (shirtResult) return shirtResult;

    const bottomCandidates = [
      'shorts',
      'bottom',
      'pant',
      'trouser',
      'legging',
      'jogger',
      'skort',
      'capri',
      'tight',
      'sweatpant',
      'chino',
      'jean',
      'denim',
      'trackpant',
    ];
    const mentionsShorts = hasToken('shorts', 'boardshort', 'boardshorts', 'walkshort', 'bermuda');
    const isPants = mentionsShorts || bottomCandidates.some((candidate) => hasToken(candidate));
    if (isPants) {
      category = '3';
      subcategory = hasToken('jean', 'denim') ? '3a' : null;
      return { category, subcategory };
    }

    const isHat = hasToken('hat', 'cap', 'beanie', 'visor', 'bucket', 'snapback', 'trucker', 'fedora', 'toque', 'headwear', 'headband', 'balaclava');
    if (isHat || matches(/\bheadwear\b/)) {
      return { category: '4', subcategory: null };
    }

    return { category, subcategory };
  }

  const genderCodeCache = new Map<string, string>();
  let genderCodesLoaded = false;

  async function ensureGenderCodesLoaded() {
    if (genderCodesLoaded) return;
    try {
      const { data, error } = await supabase.from('genders').select('code,name');
      if (error) throw error;
      if (Array.isArray(data)) {
        for (const entry of data) {
          const code = typeof entry?.code === 'string' ? entry.code.trim() : '';
          const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
          if (!code) continue;
          const lowerCode = code.toLowerCase();
          genderCodeCache.set(lowerCode, code);
          if (name) {
            genderCodeCache.set(name.toLowerCase(), code);
          }
        }
      }
    } catch (err) {
      console.warn('[AdminDashboard] Failed to load gender codes, falling back to defaults', err);
    } finally {
      genderCodesLoaded = true;
    }
  }

  async function classifyGender(product: any, rawProduct: any): Promise<string> {
    await ensureGenderCodesLoaded();
    const productName = typeof product?.name === 'string' ? product.name : (typeof rawProduct?.productName === 'string' ? rawProduct.productName : '');
    const text = productName.toLowerCase();
    const target = text.includes('women') ? 'women' : 'unisex';
    const preferredCodes = target === 'women' ? ['w', 'women', "women's"] : ['u', 'unisex'];
    for (const key of preferredCodes) {
      const code = genderCodeCache.get(key.toLowerCase());
      if (code) return code;
    }
    return target === 'women' ? 'w' : 'u';
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
      const front = color.frontUrl ?? color.front ?? color.imageUrl ?? color.url ?? null;
      const back = color.backUrl ?? color.back ?? null;
      return {
        ...color,
        frontUrl: front ?? null,
        backUrl: back ?? null,
      };
    }).filter((color: any) => {
      if (!color || typeof color !== 'object') return false;
      const frontCandidate = color.frontUrl ?? color.frontURL ?? color.frontImage ?? color.front ?? color.imageUrl ?? color.url ?? null;
      const backCandidate = color.backUrl ?? color.backURL ?? color.backImage ?? color.back ?? null;
      return (
        typeof frontCandidate === 'string' && frontCandidate.trim() &&
        typeof backCandidate === 'string' && backCandidate.trim()
      );
    });
    if (!normalizedColors.length) {
      throw new Error('No colors with complete front/back previews were returned for that style.');
    }
    product.colors = normalizedColors as any;

    let defaultColor = product.colors.find((c: any) => c.id === product.defaultColorId) || product.colors[0];
    if (!defaultColor) {
      throw new Error('No colors available after filtering.');
    }
    if (!defaultColor.frontUrl || !defaultColor.backUrl) {
      const fallback = product.colors.find((c: any) => c.frontUrl && c.backUrl);
      if (fallback) {
        defaultColor = fallback;
        product.defaultColorId = fallback.id;
      }
    }
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

    const resolvedSide = null;

    const record: ClothingRecord = {
      code,
      name: product.name ?? code,
      brand: detectedBrand,
      colors: product.colors,
      grid,
      backgrounds: {
        front: defaultColor?.frontUrl ?? null,
        side: resolvedSide,
        back: defaultColor?.backUrl ?? null,
      },
      default_color_id: product.defaultColorId ?? null,
      updated_at: new Date().toISOString(),
    };
    // No side imagery required; backgrounds only use front/back.

    if (sizeMeasurements.length) {
      (record as any).size_measurements = sizeMeasurements;
    }

    const classification = classifyProductCategory(product, rawProduct);
    if (classification.category) {
      (record as any).category = classification.category;
    }
    if (classification.subcategory) {
      (record as any).subcategory = classification.subcategory;
    }

    const genderGuess = await classifyGender(product, rawProduct);
    if (genderGuess) {
      (record as any).gender = genderGuess;
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

  async function updateAllClothing() {
    if (updateAllBusy.value || !items.value.length) return;
    updateAllBusy.value = true;
    updateError.value = '';
    updateSuccess.value = '';

    try {
      const skipped: string[] = [];
      const failures: Array<{ id: string; message: string }> = [];
      let updatedCount = 0;

      for (const item of items.value) {
        const identifier = resolveIdentifier(item);
        if (!identifier) continue;
        try {
          await upsertClothingFromPromo(identifier);
          updatedCount += 1;
        } catch (err: any) {
          console.error('[AdminDashboard] Update-all failure for', identifier, err);
          const message = String(err?.message ?? 'Unknown error');
          if (
            /No preview imagery available/i.test(message) ||
            /No colors with complete front\/side\/back previews were returned/i.test(message)
          ) {
            skipped.push(identifier);
            continue;
          }
          failures.push({ id: identifier, message });
          continue;
        }
      }
      if (updatedCount > 0) {
        updateSuccess.value = `Updated ${updatedCount} style${updatedCount === 1 ? '' : 's'}${skipped.length ? ` (skipped ${skipped.length} with missing imagery)` : ''}.`;
        await refreshList();
      }
      if (failures.length) {
        const summary = failures
          .slice(0, 5)
          .map(({ id, message }) => `${id}: ${message}`)
          .join('; ');
        updateError.value = failures.length > 5
          ? `Failed to update ${failures.length} styles. Sample: ${summary}`
          : `Failed to update ${summary}`;
      } else if (!updatedCount && skipped.length) {
        updateError.value = `Skipped ${skipped.length} style${skipped.length === 1 ? '' : 's'} because preview imagery is missing.`;
      }
    } finally {
      updateAllBusy.value = false;
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
