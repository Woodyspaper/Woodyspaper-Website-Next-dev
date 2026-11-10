import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSnapshot, filterSnapshot } from "../src/catalog/filtered-catalog.ts";

const snapshot = buildSnapshot([
  { id: 1, name: "White Paper", sku: "P1", categoryIds: [2], attributes: [
    { name: "Brand", value: "Acme", show: "DESCR" },
    { name: "Supplier", value: "Private", show: "NOTSHOW" },
  ], options: [{ name: "COLOR", choices: [{ text: "White" }] }, { name: "SIZE", choices: [{ text: "A4" }] }] },
  { id: 2, name: "Blue Paper", categoryIds: [2], attributes: [{ name: "Brand", value: "Other" }],
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
