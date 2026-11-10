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

const RESPONSE_FIELDS =
  "total,items(id,name,sku,defaultDisplayedPrice,defaultDisplayedPriceFormatted,inStock,smallThumbnailUrl,thumbnailUrl,url)";

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
  limit,
  offset,
}: {
  query?: string;
  limit: number;
  offset: number;
}): Promise<CatalogProductPage> {
  const storeId =
    process.env.LIGHTSPEED_STORE_ID ?? process.env.VITE_LIGHTSPEED_STORE_ID;
  const token = process.env.LIGHTSPEED_API_TOKEN;

  if (!storeId || !/^\d+$/.test(storeId) || !token) {
    throw new CatalogNotConfiguredError();
  }

  const params = new URLSearchParams({
    enabled: "true",
    limit: String(limit),
    offset: String(offset),
    responseFields: RESPONSE_FIELDS,
  });
  const normalizedQuery = query?.trim().replace(/\s+/g, " ");
  if (normalizedQuery) params.set("keyword", normalizedQuery);

  let response: Response;
  try {
    response = await fetch(
      `https://app.ecwid.com/api/v3/${storeId}/products?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
  } catch (error) {
    throw new LightspeedRequestError(
      error instanceof DOMException && error.name === "TimeoutError" ? 504 : undefined,
    );
  }

  if (!response.ok) throw new LightspeedRequestError(response.status);

  let data: LightspeedProductResponse;
  try {
    data = (await response.json()) as LightspeedProductResponse;
  } catch {
    throw new LightspeedRequestError(response.status);
  }

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
