import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { XMLParser } from "npm:fast-xml-parser";

const soapParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

interface PromoProductRequest {
  productId?: string;
  style?: string;
  colorId?: string;
  localizationCountry?: string;
  localizationLanguage?: string;
  limitMediaPerColor?: number;
}

const BASE_URL = Deno.env.get("PROMOSTANDARDS_BASE_URL") ?? "https://promostandards.ssactivewear.com";
const PRODUCT_SERVICE_PATH = Deno.env.get("PROMOSTANDARDS_PRODUCT_PATH") ?? "/ProductData/v2/ProductDataServicev2.svc";
const MEDIA_SERVICE_PATH = Deno.env.get("PROMOSTANDARDS_MEDIA_PATH") ?? "/MediaContent/v1/MediaContentService.svc";
const PROMO_ID = Deno.env.get("PROMOSTANDARDS_ID");
const PROMO_PASSWORD = Deno.env.get("PROMOSTANDARDS_PASSWORD");
const PRODUCT_WS_VERSION = Deno.env.get("PROMOSTANDARDS_PRODUCT_WS_VERSION") ?? "2.0.0";
const MEDIA_WS_VERSION = Deno.env.get("PROMOSTANDARDS_MEDIA_WS_VERSION") ?? "1.0.0";
const PRODUCT_SOAP_ACTION = Deno.env.get("PROMOSTANDARDS_PRODUCT_SOAP_ACTION") ?? "getProduct";
const MEDIA_SOAP_ACTION = Deno.env.get("PROMOSTANDARDS_MEDIA_SOAP_ACTION") ?? "getMediaContent";
const SSA_API_BASE = Deno.env.get("SSACTIVEWEAR_API_BASE") ?? "https://api.ssactivewear.com/v2";
const SSA_API_USERNAME = Deno.env.get("SS_ACTIVEWEAR_USERNAME") ?? Deno.env.get("SSACTIVEWEAR_API_USERNAME") ?? '';
const SSA_API_PASSWORD = Deno.env.get("SS_ACTIVEWEAR_PASSWORD") ?? Deno.env.get("SSACTIVEWEAR_API_PASSWORD") ?? '';

if (!PROMO_ID || !PROMO_PASSWORD) {
  console.warn("PromoStandards credentials are not set. Set PROMOSTANDARDS_ID and PROMOSTANDARDS_PASSWORD env variables.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!PROMO_ID || !PROMO_PASSWORD) {
    return jsonResponse({ error: "PromoStandards credentials are not configured." }, 500);
  }

  try {
    const payload: PromoProductRequest = await req.json();
    const productId = (payload.productId ?? payload.style ?? "").trim();

    if (!productId) {
      return jsonResponse({ error: "Missing productId or style." }, 400);
    }

    const localizationCountry = payload.localizationCountry ?? "US";
    const localizationLanguage = payload.localizationLanguage ?? "en";

    const productData = await fetchProduct(productId, localizationCountry, localizationLanguage);

    if (!productData) {
      return jsonResponse({ error: "PromoStandards product response was empty." }, 502);
    }

    const normalizedProduct = normalizeProduct(productId, productData);
    const colors = normalizedProduct.colors;

    const colorsWithMedia = await Promise.all(colors.map(async (color) => {
      const enriched: NormalizedColor = {
        ...color,
        media: [],
        frontUrl: null,
        sideUrl: null,
        backUrl: null,
      };

      const configurationId = Array.isArray(color.configurationIds) ? color.configurationIds[0] : null;

      if (!configurationId) {
        console.warn('[SSA] Missing configuration id for color', { productId, colorId: color.id });
        return null;
      }

      try {
        const preview = await fetchColorPreview(configurationId);
        const { front: normalizedFront, side: normalizedSide, back: normalizedBack } = extractFrontBackFromPreview(preview);

        if (normalizedFront) enriched.frontUrl = normalizedFront;
        if (normalizedSide) enriched.sideUrl = normalizedSide;
        if (normalizedBack) enriched.backUrl = normalizedBack;

        if (!enriched.backUrl && normalizedFront) {
          enriched.backUrl = normalizedFront.replace('_f_', '_b_');
        }

        if (!enriched.frontUrl || !enriched.backUrl) {
          console.warn('[SSA] Incomplete preview imagery, skipping color', {
            productId,
            colorId: color.id,
            configurationId,
            preview,
          });
          return null;
        }

        console.log('[SSA] Preview selection', {
          productId,
          colorId: color.id,
          configurationId,
          frontUrl: enriched.frontUrl,
          sideUrl: enriched.sideUrl,
          backUrl: enriched.backUrl,
        });

        return enriched;
      } catch (err) {
        console.error('[SSA] Preview fetch failed', {
          productId,
          colorId: color.id,
          configurationId,
          error: `${err}`,
        });
        return null;
      }
    }));

    const filteredColors = colorsWithMedia.filter((color): color is NormalizedColor => !!color);

    const responseBody = {
      product: {
        id: productId,
        brand: normalizedProduct.brand ?? null,
        name: normalizedProduct.name ?? null,
        description: normalizedProduct.description ?? null,
        defaultColorId: normalizedProduct.defaultColorId ?? null,
        colors: filteredColors,
      },
      raw: productData,
    };

    if (!filteredColors.length) {
      return jsonResponse({ error: 'No preview imagery available for requested product' }, 404);
    }

    if (!filteredColors.some((color) => color.id === responseBody.product.defaultColorId)) {
      responseBody.product.defaultColorId = filteredColors[0].id;
    }

    return jsonResponse(responseBody, 200);
  } catch (error) {
    console.error("PromoStandards proxy error", error);
    return jsonResponse({ error: "PromoStandards proxy failure", details: `${error}` }, 500);
  }
});

async function fetchProduct(productId: string, localizationCountry: string, localizationLanguage: string) {
  const base = BASE_URL.replace(/\/$/, '');
  const url = `${base}${PRODUCT_SERVICE_PATH}`;
  const envelope = buildProductEnvelope(productId, localizationCountry, localizationLanguage);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: PRODUCT_SOAP_ACTION,
    },
    body: envelope,
  });

  const text = await safeText(res);
  if (!res.ok) {
    throw new Error(`PromoStandards product request failed (${res.status}): ${text?.slice(0, 300) ?? ''}`);
  }

  const body = parseSoapBody(text ?? '');
  const response = pick(body, ['GetProductResponse']) ?? body;
  const product = response?.Product ?? pick(response, ['product', 'ProductArray']);
  if (!product) {
    throw new Error('PromoStandards product response missing Product payload');
  }

  return { Product: product };
}

function normalizeProduct(productId: string, productData: any) {
  const root = productData?.Product ?? productData?.product ?? productData ?? {};
  const marketing = root?.ProductMarketing ?? root?.productMarketing ?? {};
  const description = marketing?.description ?? marketing?.Description ?? root?.description ?? root?.Description ?? null;
  const brandInfo = marketing?.productBrand ?? marketing?.ProductBrand ?? root?.productBrand ?? root?.ProductBrand ?? {};
  const brand = brandInfo?.name ?? brandInfo?.Name ?? null;
  const productName = marketing?.productName ?? marketing?.ProductName ?? root?.productName ?? root?.ProductName ?? description ?? productId;
  const defaultColorId = marketing?.primaryColor?.colorId ?? marketing?.PrimaryColor?.ColorId ?? root?.defaultColorId ?? root?.DefaultColorId ?? null;

  const basePrice = extractPrimaryPrice(root);
  const colors = extractColors(root, basePrice);

  return {
    id: productId,
    name: productName,
    brand,
    description,
    defaultColorId,
    colors,
  };
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : value != null ? [value] : [];
}

function extractPrimaryPrice(product: any): NormalizedPriceBreak | null {
  const groups = toArray(
    product?.ProductPriceGroupArray?.ProductPriceGroup ??
    product?.productPriceGroupArray?.productPriceGroup ??
    product?.productPriceGroups ??
    product?.ProductPriceGroups ??
    []
  );

  let chosen: NormalizedPriceBreak | null = null;

  for (const group of groups) {
    const description = group?.description ?? group?.Description ?? null;
    const groupName = group?.groupName ?? group?.GroupName ?? null;
    const currency = group?.currency ?? group?.Currency ?? null;

    const priceEntries = toArray(
      group?.ProductPriceArray?.ProductPrice ??
      group?.productPriceArray?.productPrice ??
      group?.prices ??
      group?.Prices ??
      []
    );

    for (const entry of priceEntries) {
      const rawPrice = entry?.price ?? entry?.Price ?? entry?.listPrice ?? entry?.ListPrice ?? entry?.netPrice ?? entry?.NetPrice;
      const price = typeof rawPrice === 'string' ? Number.parseFloat(rawPrice) : Number(rawPrice);
      if (!Number.isFinite(price)) continue;

      const rawQty = entry?.quantityMin ?? entry?.QuantityMin ?? entry?.minQuantity ?? entry?.MinQuantity;
      const qty = typeof rawQty === 'string' ? Number.parseInt(rawQty, 10) : Number(rawQty);
      const quantityMin = Number.isFinite(qty) ? qty : null;

      const candidate: NormalizedPriceBreak = {
        price,
        currency: (entry?.currency ?? entry?.Currency ?? currency) ?? null,
        quantityMin,
        discountCode: entry?.discountCode ?? entry?.DiscountCode ?? null,
        description,
        groupName,
      };

      if (!chosen) {
        chosen = candidate;
        continue;
      }

      const currentQty = chosen.quantityMin ?? Number.POSITIVE_INFINITY;
      const candidateQty = candidate.quantityMin ?? Number.POSITIVE_INFINITY;

      if (candidateQty < currentQty) {
        chosen = candidate;
        continue;
      }

      if (candidateQty === currentQty && candidate.price < (chosen.price ?? Number.POSITIVE_INFINITY)) {
        chosen = candidate;
      }
    }
  }

  return chosen;
}

interface NormalizedPriceBreak {
  price: number | null;
  currency: string | null;
  quantityMin: number | null;
  discountCode: string | null;
  description: string | null;
  groupName: string | null;
}

interface NormalizedColor {
  id: string;
  name: string;
  hex: string | null;
  sizes: string[];
  configurationIds: string[];
  media?: any[];
  frontUrl?: string | null;
  sideUrl?: string | null;
  backUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  quantityMin?: number | null;
}

function extractColors(product: any, basePrice?: NormalizedPriceBreak | null): NormalizedColor[] {
  const colorsMap = new Map<string, NormalizedColor & { sizeSet: Set<string>; configSet: Set<string> }>();

  function upsertColor(colorId: string, name: string | null, hex: string | null, sizes: string[], configId: string | null) {
    if (!colorId) return;
    const existing = colorsMap.get(colorId) ?? {
      id: colorId,
      name: name ?? colorId,
      hex: hex ?? null,
      sizeSet: new Set<string>(),
      configSet: new Set<string>(),
    };
    if (!existing.name && name) existing.name = name;
    if (!existing.hex && hex) existing.hex = hex;
    sizes.filter(Boolean).forEach((size) => existing.sizeSet.add(size));
    if (configId) existing.configSet.add(configId);
    colorsMap.set(colorId, existing);
  }

  const partArray = toArray(
    product?.ProductPartArray?.ProductPart ??
    product?.productPartArray?.productPart ??
    product?.productParts ??
    []
  );

  if (partArray.length) {
    for (const part of partArray) {
      const partId = part?.partId ?? part?.PartId ?? null;
      const sizeCandidates = [
        part?.ApparelSize?.labelSize,
        part?.size,
        part?.Size,
      ].filter(Boolean) as string[];
      const colors = toArray(part?.ColorArray?.Color ?? part?.colors ?? part?.Color);
      for (const color of colors) {
        const colorId = color?.colorName ?? color?.standardColorName ?? color?.colorCode ?? color?.colorId ?? color?.name ?? null;
        const colorName = color?.colorName ?? color?.name ?? color?.standardColorName ?? colorId;
        const hex = color?.hex ?? color?.hexValue ?? color?.hexColor ?? null;
        upsertColor(colorId ?? '', colorName ?? null, hex, sizeCandidates, partId);
      }
    }
  }

  const configurations = toArray(product?.productConfigurations ?? product?.ProductConfigurations ?? product?.configurations ?? []);

  for (const cfg of configurations) {
    const configId = cfg?.configurationId ?? cfg?.ConfigurationId ?? null;
    const partArrayCfg = toArray(cfg?.productParts ?? cfg?.ProductPartArray ?? cfg?.parts ?? []);
    const sizes = partArrayCfg
      .map((part: any) => part?.size ?? part?.Size ?? part?.partDescription ?? part?.description ?? null)
      .filter((size: string | null) => !!size) as string[];

    const colorArray = toArray(cfg?.productColors ?? cfg?.ProductColorArray ?? cfg?.colors ?? cfg?.ProductColors ?? []);

    for (const colorEntry of colorArray) {
      const detail = colorEntry?.colorDetail ?? colorEntry?.ColorDetail ?? colorEntry?.color ?? colorEntry?.Color ?? colorEntry ?? {};
      const colorId = detail?.colorId ?? detail?.ColorId ?? colorEntry?.colorId ?? colorEntry?.ColorId ?? detail?.colorName ?? detail?.ColorName ?? null;
      const name = detail?.name ?? detail?.Name ?? detail?.colorName ?? detail?.ColorName ?? colorId;
      const hex = detail?.hex ?? detail?.Hex ?? detail?.hexCode ?? detail?.HexCode ?? detail?.hexColor ?? detail?.HexColor ?? null;
      upsertColor(colorId ?? '', name ?? null, hex, sizes, configId);
    }
  }

  return Array.from(colorsMap.values()).map((entry) => ({
    id: entry.id,
    name: entry.name,
    hex: entry.hex,
    sizes: Array.from(entry.sizeSet.values()).sort(),
    configurationIds: Array.from(entry.configSet.values()),
    price: basePrice?.price ?? null,
    currency: basePrice?.currency ?? null,
    quantityMin: basePrice?.quantityMin ?? null,
  }));
}

function enrichColorWithMedia(color: NormalizedColor, mediaResponse: any): NormalizedColor {
  const mediaArray = extractMedia(mediaResponse);
  const colorNameLower = (color.name ?? '').toLowerCase();
  const partIdSet = new Set(color.configurationIds.map((id) => id?.toString().toLowerCase()));

  const relevantMedia = mediaArray.filter((item) => {
    const mediaColor = (item.color ?? '').toLowerCase();
    const mediaPartId = (item.partId ?? '').toLowerCase();
    if (mediaColor && colorNameLower && mediaColor === colorNameLower) return true;
    if (mediaPartId && partIdSet.size && partIdSet.has(mediaPartId)) return true;
    return false;
  });

  const pool = relevantMedia.length ? relevantMedia : mediaArray;
  const pickByClass = (priority: number[]) => {
    for (const id of priority) {
      const match = pool.find((item) => item.classTypeId === id);
      if (match) return match.url;
    }
    return undefined;
  };

  // Detect if color.id is a numeric swatch id
  let swatchId: string | null = null;
  if (/^\d+$/.test(color.id)) {
    swatchId = color.id;
  }

  let front: string | null = null;
  let back: string | null = null;
  let side: string | null = null;

  if (swatchId) {
    // Use swatch id directly for CDN URLs
    front = `${CDN_COLOR_BASE}/${swatchId}_f_fl.jpg`;
    side = `${CDN_COLOR_BASE}/${swatchId}_d_fl.jpg`;
    back = `${CDN_COLOR_BASE}/${swatchId}_b_fl.jpg`;
  } else {
    // Fallback to existing logic with extractColorCodeFromMedia
    front =
      pickByClass(CLASS_TYPE_PRIORITY.FRONT)
      ?? pool.find((item) => /front|primary/i.test(item.classType ?? item.location ?? item.description ?? ''))?.url
      ?? pool.find((item) => /_f_/i.test(item.url))?.url
      ?? pool[0]?.url
      ?? null;

    back =
      pickByClass(CLASS_TYPE_PRIORITY.BACK)
      ?? pool.find((item) => /rear|back/i.test(item.classType ?? item.location ?? item.description ?? ''))?.url
      ?? pool.find((item) => /_b_/i.test(item.url))?.url
      ?? pool.find((item) => item.url && item.url !== front)?.url
      ?? null;

    side =
      pool.find((item) => /side|profile|left|right/i.test(item.classType ?? item.location ?? item.description ?? ''))?.url
      ?? pool.find((item) => /_(sd|d|s)_/i.test(item.url) && item.url !== front && item.url !== back)?.url
      ?? null;

    // Only call extractColorCodeFromMedia if swatchId was not found
    const colorCode = extractColorCodeFromMedia(mediaArray, colorNameLower) ?? extractColorCodeFromMedia(pool, colorNameLower);
    if (colorCode) {
      front = `${CDN_COLOR_BASE}/${colorCode}_f_fl.jpg`;
      if (!side) side = `${CDN_COLOR_BASE}/${colorCode}_d_fl.jpg`;
      if (!back) back = `${CDN_COLOR_BASE}/${colorCode}_b_fl.jpg`;
    } else {
      if (!front && pool.length) front = pool[0]?.url ?? null;
      if (!back && pool.length) back = pool.find((item) => item.url && item.url !== front)?.url ?? pool[0]?.url ?? null;
    }
  }
  if (!side) {
    side = deriveSideUrl(front) ?? deriveSideUrl(back);
  }

  return {
    ...color,
    media: pool,
    frontUrl: front,
    sideUrl: side,
    backUrl: back,
  };
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch (_) {
    return null;
  }
}

function parseSoapBody(xml: string) {
  const parsed = soapParser.parse(xml);
  const envelope = pick(parsed, ['s:Envelope', 'soap:Envelope', 'Envelope']) ?? parsed;
  const body = pick(envelope, ['s:Body', 'soap:Body', 'Body']) ?? envelope;
  const fault = pick(body, ['s:Fault', 'soap:Fault', 'Fault']);
  if (fault) {
    const simplifiedFault = simplifyXml(fault);
    const description =
      typeof simplifiedFault === 'string'
        ? simplifiedFault
        : simplifiedFault?.faultstring ?? simplifiedFault?.faultString ?? simplifiedFault?.description ?? JSON.stringify(simplifiedFault);
    throw new Error(`PromoStandards SOAP fault: ${description}`);
  }
  return simplifyXml(body);
}

function simplifyXml(node: any): any {
  if (Array.isArray(node)) return node.map(simplifyXml);
  if (node && typeof node === 'object') {
    const entries = Object.entries(node).filter(([key]) => !key.startsWith('@'));
    if (entries.length === 1 && entries[0][0] === '#text') {
      return simplifyXml(entries[0][1]);
    }
    const hasText = entries.find(([key]) => key === '#text');
    if (hasText && entries.length === 1) {
      return simplifyXml(hasText[1]);
    }
    const result: Record<string, any> = {};
    for (const [key, value] of entries) {
      if (key === '#text') {
        return simplifyXml(value);
      }
      result[key] = simplifyXml(value);
    }
    return result;
  }
  return node;
}

function pick(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function buildProductEnvelope(productId: string, localizationCountry: string, localizationLanguage: string) {
  const ns = `http://www.promostandards.org/WSDL/ProductDataService/${PRODUCT_WS_VERSION}/`;
  const sharedNs = `${ns}SharedObjects/`;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetProductRequest xmlns="${ns}" xmlns:sh="${sharedNs}">
      <sh:wsVersion>${escapeXml(PRODUCT_WS_VERSION)}</sh:wsVersion>
      <sh:id>${escapeXml(PROMO_ID ?? "")}</sh:id>
      ${PROMO_PASSWORD ? `<sh:password>${escapeXml(PROMO_PASSWORD)}</sh:password>` : ''}
      <sh:localizationCountry>${escapeXml(localizationCountry)}</sh:localizationCountry>
      <sh:localizationLanguage>${escapeXml(localizationLanguage)}</sh:localizationLanguage>
      <sh:productId>${escapeXml(productId)}</sh:productId>
    </GetProductRequest>
  </soap:Body>
</soap:Envelope>`;
}

function buildMediaEnvelope(
  productId: string,
  colorId: string | null,
  configurationId: string | null,
  localizationCountry: string,
  localizationLanguage: string,
  limit: number,
) {
  const ns = `http://www.promostandards.org/WSDL/MediaService/${MEDIA_WS_VERSION}/`;
  const sharedNs = `${ns}SharedObjects/`;
  const cultureName = `${localizationLanguage}-${localizationCountry}`;
  const partElement = configurationId ? `<sh:partId>${escapeXml(configurationId)}</sh:partId>` : '';
  const colorElement = colorId ? `<sh:colorName>${escapeXml(colorId)}</sh:colorName>` : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetMediaContentRequest xmlns="${ns}" xmlns:sh="${sharedNs}">
      <sh:wsVersion>${escapeXml(MEDIA_WS_VERSION)}</sh:wsVersion>
      <sh:id>${escapeXml(PROMO_ID ?? "")}</sh:id>
      ${PROMO_PASSWORD ? `<sh:password>${escapeXml(PROMO_PASSWORD)}</sh:password>` : ''}
      <sh:cultureName>${escapeXml(cultureName)}</sh:cultureName>
      <sh:mediaType>Image</sh:mediaType>
      <sh:productId>${escapeXml(productId)}</sh:productId>
      ${partElement}
      ${colorElement}
    </GetMediaContentRequest>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function buildSsaHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (SSA_API_USERNAME && SSA_API_PASSWORD) {
    const token = btoa(`${SSA_API_USERNAME}:${SSA_API_PASSWORD}`);
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

async function fetchColorPreview(configurationId: string) {
  const trimmed = (configurationId || '').trim();
  if (!trimmed) return null;
  const base = SSA_API_BASE.replace(/\/$/, '');
  const url = `${base}/products/${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildSsaHeaders(),
  });
  if (!res.ok) {
    throw new Error(`SSActivewear REST request failed (${res.status})`);
  }
  return await res.json();
}

function normalizeImagePath(path?: string | null) {
  if (!path) return null;
  const adjusted = path.replace('_fm', '_fl').replace(/^\/+/, '');
  return `https://cdn.ssactivewear.com/${adjusted}`;
}

function deriveSideUrl(url: string | null): string | null {
  if (!url) return null;
  const replacements: Array<[RegExp, string]> = [
    [/_f_/i, '_sd_'],
    [/_f_/i, '_d_'],
    [/front/i, 'side'],
    [/Front/, 'Side'],
    [/_b_/i, '_sd_'],
    [/_b_/i, '_d_'],
    [/back/i, 'side'],
    [/Back/, 'Side'],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(url)) {
      const candidateUrl = url.replace(pattern, replacement);
      if (candidateUrl !== url) return candidateUrl;
    }
  }
  return null;
}

function extractFrontBackFromPreview(preview: any) {
  if (!preview) return { front: null, side: null, back: null };

  const payload = Array.isArray(preview) && preview.length === 1 ? preview[0] : preview;
  let candidate = payload;

  if (payload?.colors && Array.isArray(payload.colors) && payload.colors.length) {
    candidate = payload.colors[0];
  }

  const pickImage = (source: any, keys: string[]): string | null => {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  };

  const searchNestedForSide = (node: any): string | null => {
    const queue: any[] = Array.isArray(node) ? [...node] : [node];
    const visited = new Set<any>();
    const keyPattern = /(side|left|right)/i;
    const urlPattern = /(_sd_|_d_|_s_|side)/i;

    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || visited.has(current)) continue;
      visited.add(current);

      for (const [key, value] of Object.entries(current)) {
        if (typeof value === 'string') {
          if (keyPattern.test(key) || urlPattern.test(value)) {
            if (value.trim()) return value;
          }
        } else if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }
    return null;
  };

  const frontPath = pickImage(candidate, ['colorFrontImage', 'ColorFrontImage', 'frontImage', 'FrontImage']);
  const backPath = pickImage(candidate, ['colorBackImage', 'ColorBackImage', 'backImage', 'BackImage']);
  const sidePath =
    pickImage(candidate, [
      'colorSideImage',
      'ColorSideImage',
      'sideImage',
      'SideImage',
      'colorLeftImage',
      'ColorLeftImage',
      'leftImage',
      'LeftImage',
      'colorRightImage',
      'ColorRightImage',
      'rightImage',
      'RightImage',
    ]) ?? searchNestedForSide(candidate);

  const front = normalizeImagePath(frontPath);
  const back = normalizeImagePath(backPath);
  let side = normalizeImagePath(sidePath);

  if (!side) {
    side =
      normalizeImagePath(deriveSideUrl(frontPath)) ??
      normalizeImagePath(deriveSideUrl(backPath)) ??
      deriveSideUrl(front) ??
      deriveSideUrl(back);
  }

  return { front, side, back };
}
