import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSnapshot, filterSnapshot } from "../src/catalog/filtered-catalog.ts";

const snapshot = buildSnapshot([
  { id: 1, name: "White Paper", sku: "P1", defaultDisplayedPrice: 5, inStock: true, categoryIds: [2], attributes: [
    { name: "Brand", value: "Acme", show: "DESCR" },
    { name: "Supplier", value: "Private", show: "NOTSHOW" },
  ], options: [{ name: "COLOR", choices: [{ text: "White" }] }, { name: "SIZE", choices: [{ text: "A4" }] }] },
  { id: 2, name: "Blue Paper", defaultDisplayedPrice: 20, inStock: false, categoryIds: [2], attributes: [{ name: "Brand", value: "Other" }],
    options: [{ name: "Color", choices: [{ text: "Blue" }] }, { name: "Finish", choices: [{ text: "Matte" }] }] },
], [{ id: 1, name: "Supplies" }, { id: 2, name: "Paper", parentId: 1 }]);

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
