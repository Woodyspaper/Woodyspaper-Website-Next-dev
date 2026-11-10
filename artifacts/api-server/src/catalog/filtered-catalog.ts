import { CatalogNotConfiguredError, LightspeedRequestError, type CatalogProduct } from "./lightspeed.ts";
import { sizeFromName } from "./product-size.ts";
import type { GetCatalogProductsParams } from "@workspace/api-zod";

type CatalogSort = GetCatalogProductsParams["sort"];

type RawProduct = {
  id: number; name: string; sku?: string; defaultDisplayedPrice?: number;
  defaultDisplayedPriceFormatted?: string; inStock?: boolean; smallThumbnailUrl?: string;
  thumbnailUrl?: string; url?: string; categoryIds?: number[];
  attributes?: { name: string; value: string; show?: string }[];
  options?: { name: string; choices?: { text: string }[] }[];
};
type Category = { id: number; name: string; parentId?: number; enabled?: boolean };
type IndexedProduct = { product: CatalogProduct; values: Record<string, string[]> };
type Snapshot = { products: IndexedProduct[]; labels: Map<string, string>; categories: Map<string, string> };
let cached: { identity: string; expires: number; snapshot: Snapshot } | undefined;
let pending: { identity: string; promise: Promise<Snapshot> } | undefined;

const canonical = (name: string) => {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return ({ colour: "color", manufacturer: "brand", dimensions: "size", uom: "unit" } as Record<string, string>)[key] || key;
};
const labelFor = (key: string) => key === "unit" ? "Unit of measure" : key.replace(/\b\w/g, c => c.toUpperCase());

export function buildSnapshot(raw: RawProduct[], categoryList: Category[]): Snapshot {
  const categories = new Map(categoryList.filter(c => c.enabled !== false).map(c => [String(c.id), c.name]));
  const parents = new Map(categoryList.map(c => [String(c.id), c.parentId ? String(c.parentId) : undefined]));
  const labels = new Map<string, string>([
    ["category", "Category"],
    ["availability", "Availability"],
  ]);
  const products = raw.map(p => {
    const values: Record<string, string[]> = {};
    const add = (name: string, value: string) => {
      const key = canonical(name);
      if (!key || !value.trim() || key === "category") return;
      labels.set(key, labelFor(key));
      values[key] = [...new Set([...(values[key] || []), value.trim()])];
    };
    for (const a of p.attributes || []) {
      if (a.show !== "NOTSHOW" && typeof a.value === "string") add(a.name, a.value);
    }
    for (const option of p.options || []) {
      for (const choice of option.choices || []) if (typeof choice.text === "string") add(option.name, choice.text);
    }
    if (!values.size?.length) {
      const size = sizeFromName(p.name);
      if (size) add("size", size);
    }
    const categoryIds = new Set<string>();
    for (const id of p.categoryIds || []) {
      let current: string | undefined = String(id);
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        if (categories.has(current)) categoryIds.add(current);
        current = parents.get(current);
      }
    }
    values.category = [...categoryIds];
    if (typeof p.inStock === "boolean") {
      values.availability = [p.inStock ? "in-stock" : "out-of-stock"];
    }
    return { values, product: {
      id: p.id, name: p.name, sku: p.sku || null,
      price: p.defaultDisplayedPrice ?? null, priceFormatted: p.defaultDisplayedPriceFormatted || null,
      inStock: p.inStock === true, imageUrl: p.smallThumbnailUrl || p.thumbnailUrl || null,
      productUrl: p.url || null,
    } };
  });
  return { products, labels, categories };
}

export function filterSnapshot(
  snapshot: Snapshot,
  query: string | undefined,
  filters: Record<string, string>,
  limit: number,
  offset: number,
  priceRange: { minPrice?: number; maxPrice?: number } = {},
  sort?: CatalogSort,
) {
  const words = (query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searched = snapshot.products.filter(p => words.every(word =>
    `${p.product.name} ${p.product.sku || ""}`.toLowerCase().includes(word)));
  const matches = (p: IndexedProduct, except?: string) => Object.entries(filters).every(([key, value]) =>
    key === except || p.values[key]?.includes(value));
  const matchesPrice = (p: IndexedProduct) => {
    if (priceRange.minPrice === undefined && priceRange.maxPrice === undefined) return true;
    if (p.product.price === null) return false;
    return (priceRange.minPrice === undefined || p.product.price >= priceRange.minPrice) &&
      (priceRange.maxPrice === undefined || p.product.price <= priceRange.maxPrice);
  };
  const filtered = searched.filter(p => matches(p) && matchesPrice(p));
  if (sort) {
    const direction = sort.endsWith("-desc") ? -1 : 1;
    filtered.sort(({ product: a }, { product: b }) => {
      if (sort.startsWith("price-")) {
        // Unknown prices stay last in both directions.
        if (a.price === null && b.price !== null) return 1;
        if (b.price === null && a.price !== null) return -1;
        return direction * ((a.price ?? 0) - (b.price ?? 0)) || a.id - b.id;
      }
      return direction * a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }) || a.id - b.id;
    });
  }
  const priority = ["category", "availability", "brand", "size", "color", "finish"];
  const facets = [...snapshot.labels].map(([key, label]) => {
    const counts = new Map<string, number>();
    for (const p of searched) if (matches(p, key) && matchesPrice(p)) {
      for (const value of p.values[key] || []) counts.set(value, (counts.get(value) || 0) + 1);
    }
    if (filters[key] && !counts.has(filters[key])) counts.set(filters[key], 0);
    return { key, label, options: [...counts].map(([value, count]) => ({
      value,
      label: key === "category"
        ? snapshot.categories.get(value) || value
        : key === "availability"
          ? value === "in-stock" ? "In stock" : "Out of stock"
          : value,
      count,
    })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) };
  }).filter(f => f.options.length).sort((a, b) =>
    (priority.includes(a.key) ? priority.indexOf(a.key) : 99) -
    (priority.includes(b.key) ? priority.indexOf(b.key) : 99) || a.label.localeCompare(b.label));
  return { items: filtered.slice(offset, offset + limit).map(p => p.product), total: filtered.length, limit, offset, facets };
}

async function loadSnapshot(): Promise<Snapshot> {
  const store = process.env.LIGHTSPEED_STORE_ID || process.env.VITE_LIGHTSPEED_STORE_ID;
  const token = process.env.LIGHTSPEED_API_TOKEN;
  if (!store || !/^\d+$/.test(store) || !token) throw new CatalogNotConfiguredError();
  // Cache is scoped to credentials and never served after expiry on provider failure.
  const identity = `${store}:${token}`;
  if (cached?.identity === identity && cached.expires > Date.now()) return cached.snapshot;
  if (pending?.identity === identity) return pending.promise;
  const load = async <T>(resource: string, fields: string): Promise<T[]> => {
    const items: T[] = [];
    let total = 1;
    while (items.length < total) {
      const params = new URLSearchParams({ limit: "100", offset: String(items.length), enabled: "true", responseFields: `total,items(${fields})` });
      let response: Response;
      try {
        response = await fetch(`https://app.ecwid.com/api/v3/${store}/${resource}?${params}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000),
        });
      } catch { throw new LightspeedRequestError(); }
      if (!response.ok) throw new LightspeedRequestError(response.status);
      const data = await response.json() as { total: number; items: T[] };
      if (!Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0 ||
          (data.items.length === 0 && items.length < data.total) || data.total > 50000) throw new LightspeedRequestError();
      total = data.total;
      items.push(...data.items);
    }
    return items;
  };
  const promise = Promise.all([
    load<RawProduct>("products", "id,name,sku,defaultDisplayedPrice,defaultDisplayedPriceFormatted,inStock,smallThumbnailUrl,thumbnailUrl,url,categoryIds,attributes,options"),
    load<Category>("categories", "id,name,parentId,enabled"),
  ]).then(([products, categories]) => {
    if (products.some(p => !Number.isInteger(p.id) || typeof p.name !== "string")) throw new LightspeedRequestError();
    const snapshot = buildSnapshot(products, categories);
    cached = { identity, snapshot, expires: Date.now() + 60000 };
    return snapshot;
  });
  pending = { identity, promise };
  try { return await promise; } finally { if (pending?.promise === promise) pending = undefined; }
}

export async function getFilteredCatalog(
  query: string | undefined,
  filters: Record<string, string>,
  limit: number,
  offset: number,
  priceRange: { minPrice?: number; maxPrice?: number } = {},
  sort?: CatalogSort,
) {
  return filterSnapshot(await loadSnapshot(), query, filters, limit, offset, priceRange, sort);
}
