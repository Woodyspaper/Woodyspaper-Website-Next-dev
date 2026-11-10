export type CatalogProduct = {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  priceFormatted: string | null;
  inStock: boolean;
  imageUrl: string | null;
  productUrl: string | null;
};

export type CatalogProductPage = {
  items: CatalogProduct[];
  total: number;
  limit: number;
  offset: number;
};

export type CatalogCategory = {
  id: number;
  name: string;
};

type LightspeedProduct = {
  id?: number;
  name?: string;
  sku?: string;
  defaultDisplayedPrice?: number;
  defaultDisplayedPriceFormatted?: string;
  inStock?: boolean;
  smallThumbnailUrl?: string;
  thumbnailUrl?: string;
  url?: string;
};

type LightspeedProductResponse = {
  total?: number;
  items?: LightspeedProduct[];
};

type LightspeedCategory = {
  id?: number;
  name?: string;
  enabled?: boolean;
};

type LightspeedCategoryResponse = {
  total?: number;
  items?: LightspeedCategory[];
};

const RESPONSE_FIELDS =
  "total,items(id,name,sku,defaultDisplayedPrice,defaultDisplayedPriceFormatted,inStock,smallThumbnailUrl,thumbnailUrl,url)";
const CATEGORY_RESPONSE_FIELDS = "total,items(id,name,enabled)";
const PROVIDER_PAGE_SIZE = 100;

export class CatalogNotConfiguredError extends Error {}
export class LightspeedRequestError extends Error {
  readonly upstreamStatus?: number;

  constructor(upstreamStatus?: number) {
    super("The product provider could not return inventory.");
    this.upstreamStatus = upstreamStatus;
  }
}

/**
 * First catalog adapter. Other POS systems can implement this same page shape
 * without exposing provider credentials to the browser.
 */
export async function getLightspeedProducts({
  query,
  categoryId,
  availability,
  minPrice,
  maxPrice,
  limit,
  offset,
}: {
  query?: string;
  categoryId?: number;
  availability?: "in-stock" | "out-of-stock";
  minPrice?: number;
  maxPrice?: number;
  limit: number;
  offset: number;
}): Promise<CatalogProductPage> {
  const { storeId, token } = getLightspeedCredentials();

  const params = new URLSearchParams({
    enabled: "true",
    limit: String(limit),
    offset: String(offset),
    responseFields: RESPONSE_FIELDS,
  });
  const normalizedQuery = query?.trim().replace(/\s+/g, " ");
  if (normalizedQuery) params.set("keyword", normalizedQuery);
  if (categoryId !== undefined) params.set("category", String(categoryId));
  if (availability) params.set("inStock", String(availability === "in-stock"));
  if (minPrice !== undefined) params.set("priceFrom", String(minPrice));
  if (maxPrice !== undefined) params.set("priceTo", String(maxPrice));

  const { response, data } = await fetchLightspeedJson<LightspeedProductResponse>(
    `https://app.ecwid.com/api/v3/${storeId}/products?${params.toString()}`,
    token,
  );

  if (
    !Array.isArray(data.items) ||
    typeof data.total !== "number" ||
    !Number.isInteger(data.total)
  ) {
    throw new LightspeedRequestError(response.status);
  }

  const items = data.items.flatMap((product): CatalogProduct[] => {
    if (!Number.isInteger(product.id) || typeof product.name !== "string") return [];
    return [
      {
        id: product.id as number,
        name: product.name,
        sku: product.sku || null,
        price:
          typeof product.defaultDisplayedPrice === "number"
            ? product.defaultDisplayedPrice
            : null,
        priceFormatted: product.defaultDisplayedPriceFormatted || null,
        inStock: product.inStock === true,
        imageUrl: product.smallThumbnailUrl || product.thumbnailUrl || null,
        productUrl: product.url || null,
      },
    ];
  });

  return { items, total: data.total, limit, offset };
}

export async function getLightspeedCategories(): Promise<CatalogCategory[]> {
  const { storeId, token } = getLightspeedCredentials();
  const categories: CatalogCategory[] = [];
  let total = 0;
  let offset = 0;

  do {
    const params = new URLSearchParams({
      limit: String(PROVIDER_PAGE_SIZE),
      offset: String(offset),
      responseFields: CATEGORY_RESPONSE_FIELDS,
    });
    const { response, data } = await fetchLightspeedJson<LightspeedCategoryResponse>(
      `https://app.ecwid.com/api/v3/${storeId}/categories?${params.toString()}`,
      token,
    );

    if (
      !Array.isArray(data.items) ||
      typeof data.total !== "number" ||
      !Number.isInteger(data.total)
    ) {
      throw new LightspeedRequestError(response.status);
    }

    total = data.total;
    if (data.items.length === 0 && offset < total) {
      throw new LightspeedRequestError(response.status);
    }
    categories.push(
      ...data.items.flatMap((category): CatalogCategory[] => {
        if (
          !Number.isInteger(category.id) ||
          typeof category.name !== "string" ||
          category.enabled === false
        ) {
          return [];
        }
        return [{ id: category.id as number, name: category.name }];
      }),
    );
    offset += data.items.length;
  } while (offset < total);

  return categories;
}

function getLightspeedCredentials() {
  const storeId =
    process.env.LIGHTSPEED_STORE_ID ?? process.env.VITE_LIGHTSPEED_STORE_ID;
  const token = process.env.LIGHTSPEED_API_TOKEN;

  if (!storeId || !/^\d+$/.test(storeId) || !token) {
    throw new CatalogNotConfiguredError();
  }

  return { storeId, token };
}

async function fetchLightspeedJson<T>(
  url: string,
  token: string,
): Promise<{ response: Response; data: T }> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new LightspeedRequestError(
      error instanceof DOMException && error.name === "TimeoutError" ? 504 : undefined,
    );
  }

  if (!response.ok) throw new LightspeedRequestError(response.status);

  try {
    return { response, data: (await response.json()) as T };
  } catch {
    throw new LightspeedRequestError(response.status);
  }
}
