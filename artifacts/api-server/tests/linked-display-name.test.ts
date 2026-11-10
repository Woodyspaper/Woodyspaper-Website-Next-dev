import test from "node:test";
import assert from "node:assert/strict";
import { linkedDisplayName, getCustomer, findCustomer } from "../src/accounts/lightspeed-account.ts";

test("verified Lightspeed name takes precedence without splitting names", () => {
  assert.equal(linkedDisplayName({ id: 1, email: "buyer@example.com", name: "  Alex del Rio  " }, "BUYER@example.com", ["buyer@example.com"], "Website Name"), "Alex del Rio");
});

test("missing or blank Lightspeed name preserves website name", () => {
  for (const name of [undefined, "", "  "]) {
    assert.equal(linkedDisplayName({ id: 1, email: "buyer@example.com", name }, "buyer@example.com", ["buyer@example.com"], "Website Name"), "Website Name");
  }
});

test("unverified or changed provider email cannot supply a display name", () => {
  const customer = { id: 1, email: "buyer@example.com", name: "Private Name" };
  assert.throws(() => linkedDisplayName(customer, "buyer@example.com", [], "Website Name"));
  assert.throws(() => linkedDisplayName(customer, "other@example.com", ["other@example.com"], "Website Name"));
});

test("customer requests include the provider name", async (t) => {
  // Fake token and fetch are confined to this test process; no provider calls are made.
  const original = process.env.LIGHTSPEED_API_TOKEN;
  process.env.LIGHTSPEED_API_TOKEN = "test-only";
  t.after(() => { if (original === undefined) delete process.env.LIGHTSPEED_API_TOKEN; else process.env.LIGHTSPEED_API_TOKEN = original; });
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const request = new URL(url);
    assert.match(request.searchParams.get("responseFields")!, /\bname\b/);
    const customer = { id: 1, email: "buyer@example.com", name: "Alex del Rio" };
    return Response.json(request.pathname.endsWith("/customers") ? { total: 1, items: [customer] } : customer);
  });
  assert.equal((await getCustomer("123", "1")).name, "Alex del Rio");
  assert.equal((await findCustomer("123", "buyer@example.com")).name, "Alex del Rio");
});
