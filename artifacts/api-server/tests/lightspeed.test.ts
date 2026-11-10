import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  CatalogNotConfiguredError,
  getLightspeedProducts,
  LightspeedRequestError,
} from "../src/catalog/lightspeed.ts";

const originalFetch = globalThis.fetch;
const originalStoreId = process.env.VITE_LIGHTSPEED_STORE_ID;
const originalApiStoreId = process.env.LIGHTSPEED_STORE_ID;
const originalToken = process.env.LIGHTSPEED_API_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("VITE_LIGHTSPEED_STORE_ID", originalStoreId);
  restoreEnv("LIGHTSPEED_STORE_ID", originalApiStoreId);
  restoreEnv("LIGHTSPEED_API_TOKEN", originalToken);
});

test("requires a store ID and server-only API token", async () => {
  delete process.env.VITE_LIGHTSPEED_STORE_ID;
  delete process.env.LIGHTSPEED_STORE_ID;
  delete process.env.LIGHTSPEED_API_TOKEN;

  await assert.rejects(
    () => getLightspeedProducts({ limit: 24, offset: 0 }),
    CatalogNotConfiguredError,
  );
});

test("maps a bounded Lightspeed catalog page to the public API shape", async () => {
  process.env.LIGHTSPEED_STORE_ID = "123456";
  process.env.LIGHTSPEED_API_TOKEN = "test-server-token";

  let requestedUrl: URL | undefined;
  let requestedAuthorization: string | null = null;
  globalThis.fetch = async (input, init) => {
    requestedUrl = new URL(String(input));
    requestedAuthorization = new Headers(init?.headers).get("Authorization");
    return Response.json({
      total: 1,
      items: [
        {
          id: 42,
          name: "Lunch napkin",
          sku: "1234 - Base",
          defaultDisplayedPrice: 8.75,
          defaultDisplayedPriceFormatted: "$8.75",
          inStock: true,
          smallThumbnailUrl: "https://images.example/product.jpg",
          url: "https://store.example/product",
        },
      ],
    });
  };

  const page = await getLightspeedProducts({
    query: "  lunch   napkin ",
    limit: 24,
    offset: 48,
  });

  assert.equal(requestedUrl?.origin, "https://app.ecwid.com");
  assert.equal(requestedUrl?.pathname, "/api/v3/123456/products");
  assert.equal(requestedUrl?.searchParams.get("keyword"), "lunch napkin");
  assert.equal(requestedUrl?.searchParams.get("limit"), "24");
  assert.equal(requestedUrl?.searchParams.get("offset"), "48");
  assert.equal(requestedAuthorization, "Bearer test-server-token");
  assert.deepEqual(page, {
    total: 1,
    limit: 24,
    offset: 48,
    items: [
      {
        id: 42,
        name: "Lunch napkin",
        sku: "1234 - Base",
        price: 8.75,
        priceFormatted: "$8.75",
        inStock: true,
        imageUrl: "https://images.example/product.jpg",
        productUrl: "https://store.example/product",
      },
    ],
  });
});

test("does not treat an upstream provider failure as an empty catalog", async () => {
  process.env.VITE_LIGHTSPEED_STORE_ID = "123456";
  process.env.LIGHTSPEED_API_TOKEN = "test-server-token";
  globalThis.fetch = async () => new Response("upstream error", { status: 401 });

  await assert.rejects(
    () => getLightspeedProducts({ limit: 24, offset: 0 }),
    (error: unknown) =>
      error instanceof LightspeedRequestError && error.upstreamStatus === 401,
  );
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
