import assert from "node:assert/strict";
import { test } from "node:test";
import { sizeFromName } from "../src/catalog/product-size.ts";
import { buildSnapshot, filterSnapshot } from "../src/catalog/filtered-catalog.ts";

test("normalizes decimals, mixed fractions, unicode and compact dimensions", () => {
  for (const name of ['8.5X11 PAPER', '8-1/2 X 11 PAPER', '8 1/2 × 11 PAPER', '8½ X 11 PAPER']) {
    assert.equal(sizeFromName(name), '8.5 × 11');
  }
  assert.equal(sizeFromName('#10 (4 1/8 X 9 1/2) ENVELOPE'), '4.125 × 9.5');
  assert.equal(sizeFromName('9 X 12 ENVELOPE WINDOW (SIZE 1-3/8 X 4)'), '9 × 12');
  assert.equal(sizeFromName('10 x 20 x 30 cm BOX'), '10 × 20 × 30 cm');
  assert.equal(sizeFromName('8.5" x 11" PAPER'), '8.5 × 11 in');
});
test("does not infer dimensions from pack counts, weight, or embedded SKU codes", () => {
  for (const name of ['24# PAPER 500/PK 5BX/CT 61595', 'MODEL AB12X34CD', 'PLAIN PAPER']) {
    assert.equal(sizeFromName(name), undefined);
  }
});
test("name sizes filter the catalog before pagination without overriding structured size", () => {
  const snapshot = buildSnapshot([
    { id: 1, name: '8.5X11 PAPER' },
    { id: 2, name: '8-1/2 X 11 PAPER' },
    { id: 3, name: '8.5X11 PAPER', options: [{ name: 'Size', choices: [{ text: 'Custom' }] }] },
    { id: 4, name: 'NO DIMENSIONS' },
  ], []);
  const page = filterSnapshot(snapshot, '', { size: '8.5 × 11' }, 1, 1);
  assert.equal(page.total, 2);
  assert.equal(page.items[0].id, 2);
  assert.equal(filterSnapshot(snapshot, '', { size: 'Custom' }, 24, 0).items[0].id, 3);
});
