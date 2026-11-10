import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSnapshot, filterSnapshot } from "../src/catalog/filtered-catalog.ts";
import { GetCatalogProductsQueryParams } from "../../../lib/api-zod/src/generated/api.ts";

const snapshot = buildSnapshot([
  { id: 1, name: "White Paper", sku: "P1", defaultDisplayedPrice: 5, inStock: true, categoryIds: [2], attributes: [
    { name: "Brand", value: "Acme", show: "DESCR" },
    { name: "Supplier", value: "Private", show: "NOTSHOW" },
  ], options: [{ name: "COLOR", choices: [{ text: "White" }] }, { name: "SIZE", choices: [{ text: "A4" }] }] },
  { id: 2, name: "Blue Paper", defaultDisplayedPrice: 20, inStock: false, categoryIds: [2], attributes: [{ name: "Brand", value: "Other" }],
    options: [{ name: "Color", choices: [{ text: "Blue" }] }, { name: "Finish", choices: [{ text: "Matte" }] }] },
], [{ id: 1, name: "Supplies" }, { id: 2, name: "Paper", parentId: 1 }]);

test("sorts all matches before paging without changing totals, facets, or cached order", () => {
  const base = filterSnapshot(snapshot, "paper", { category: "1" }, 1, 0);
  for (const [sort, ids] of [
    ["name-asc", [2, 1]], ["name-desc", [1, 2]],
    ["price-asc", [1, 2]], ["price-desc", [2, 1]],
  ] as const) {
    for (const offset of [0, 1]) {
      const page = filterSnapshot(snapshot, "paper", { category: "1" }, 1, offset, {}, sort);
      assert.equal(page.items[0].id, ids[offset]);
      assert.equal(page.total, base.total);
      assert.deepEqual(page.facets, base.facets);
      assert.equal(page.offset, offset);
      assert.equal(page.limit, 1);
    }
    assert.equal(filterSnapshot(snapshot, "paper", { availability: "in-stock" }, 24, 0, { maxPrice: 10 }, sort).total, 1);
  }
  assert.deepEqual(filterSnapshot(snapshot, "paper", { category: "1" }, 1, 0), base);
});

test("handles price ties, free items, missing prices, and name ties deterministically", () => {
  const data = buildSnapshot([
    { id: 5, name: "Unknown" },
    { id: 3, name: "paper", defaultDisplayedPrice: 10 },
    { id: 2, name: "Paper", defaultDisplayedPrice: 10 },
    { id: 1, name: "Free", defaultDisplayedPrice: 0 },
    { id: 4, name: "Unknown" },
  ], []);
  const ids = (sort: "price-asc" | "price-desc" | "name-asc") =>
    filterSnapshot(data, "", {}, 24, 0, {}, sort).items.map(p => p.id);
  assert.deepEqual(ids("price-asc"), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids("price-desc"), [2, 3, 1, 4, 5]);
  assert.deepEqual(ids("name-asc"), [1, 2, 3, 4, 5]);
  assert.equal(filterSnapshot(data, "missing", {}, 24, 0, {}, "price-asc").total, 0);
});

test("validates the sort API parameter", () => {
  for (const sort of ["name-asc", "name-desc", "price-asc", "price-desc"]) {
    assert.equal(GetCatalogProductsQueryParams.safeParse({ sort }).success, true);
  }
  assert.equal(GetCatalogProductsQueryParams.safeParse({}).success, true);
  assert.equal(GetCatalogProductsQueryParams.safeParse({ sort: "invalid" }).success, false);
});

test("combines filters before paging and includes ancestor categories", () => {
  const result = filterSnapshot(snapshot, "paper", { category: "1", brand: "Acme", size: "A4", color: "White" }, 1, 0);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 1);
  assert.equal(filterSnapshot(snapshot, "", { category: "1" }, 1, 1).items[0].id, 2);
});
test("excludes hidden metadata and counts alternatives without current facet", () => {
  const result = filterSnapshot(snapshot, "", { color: "White" }, 24, 0);
  assert.ok(!result.facets.some(f => f.key === "supplier"));
  assert.equal(result.facets.find(f => f.key === "color")?.options.length, 2);
  assert.equal(filterSnapshot(snapshot, "", { color: "Missing" }, 24, 0).total, 0);
});

test("filters availability and price before paging and returns backend option counts", () => {
  const result = filterSnapshot(
    snapshot,
    "paper",
    { availability: "in-stock" },
    1,
    0,
    { minPrice: 4, maxPrice: 6 },
  );
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 1);
  assert.deepEqual(
    result.facets.find(f => f.key === "availability")?.options.map(option => option.value),
    ["in-stock"],
  );
  assert.equal(filterSnapshot(snapshot, "", {}, 1, 1, { maxPrice: 10 }).items.length, 0);
});
