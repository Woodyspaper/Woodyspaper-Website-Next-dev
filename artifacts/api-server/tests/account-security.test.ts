import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  assertVerifiedLink, findCustomer, getOrders, mapOwnedOrders, matchVerifiedCustomer, pricingOffers, requireVerifiedLinkEmail,
} from "../src/accounts/lightspeed-account.ts";
import { AccountError } from "../src/accounts/errors.ts";
import { LinkLightspeedAccountBody } from "../../../lib/api-zod/src/generated/api.ts";

const customer = { id: 42, email: "customer@example.com", customerGroupId: 5 };
const denied = (status: number) => (e: unknown) => e instanceof AccountError && e.status === status;
const originalFetch = globalThis.fetch;
const originalToken = process.env.LIGHTSPEED_API_TOKEN;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.LIGHTSPEED_API_TOKEN;
  else process.env.LIGHTSPEED_API_TOKEN = originalToken;
});

test("a verified secondary email can link without changing the primary email", () => {
  const verified = ['primary@example.com', 'secondary@example.com'];
  assert.equal(requireVerifiedLinkEmail(' Secondary@Example.com ', verified), 'secondary@example.com');
  assert.deepEqual(verified, ['primary@example.com', 'secondary@example.com']);
});

test("unverified, foreign, and removed emails cannot be used to link", () => {
  assert.throws(() => requireVerifiedLinkEmail('unverified@example.com', ['primary@example.com']), denied(403));
  assert.throws(() => requireVerifiedLinkEmail('secondary@example.com', []), denied(403));
  assert.throws(() => requireVerifiedLinkEmail('', ['primary@example.com']), denied(403));
});

test("link input rejects customer IDs, client verification claims, and invalid emails", () => {
  const schema = LinkLightspeedAccountBody.strict();
  assert.ok(schema.safeParse({ email: 'secondary@example.com' }).success);
  for (const value of [undefined, {}, { email: 'invalid' }, { email: 'secondary@example.com', verified: true }, { email: 'secondary@example.com', customerId: '42' }]) {
    assert.equal(schema.safeParse(value).success, false);
  }
});

test("linking requires a single exact verified-email match", () => {
  assert.equal(matchVerifiedCustomer([customer], 1, "Customer@Example.com").id, 42);
  assert.throws(() => matchVerifiedCustomer([customer], 1, "other@example.com"), denied(404));
  assert.throws(() => matchVerifiedCustomer([customer, { ...customer, id: 43 }], 2, customer.email), denied(409));
  assert.throws(() => matchVerifiedCustomer([], 0, customer.email), denied(404));
});

test("provider email changes and revoked website verification block linked data", () => {
  assert.doesNotThrow(() => assertVerifiedLink(customer, customer.email, [customer.email]));
  assert.throws(() => assertVerifiedLink(customer, customer.email, []), denied(409));
  assert.throws(() => assertVerifiedLink({ ...customer, email: "new@example.com" }, customer.email, [customer.email]), denied(409));
});

test("order mapping rejects another customer's data and strips private fields", () => {
  const order = {
    id: "ORDER-1", customerId: 42, createDate: "2026-01-01", total: 25,
    paymentStatus: "PAID", fulfillmentStatus: "SHIPPED", privateAdminNotes: "PRIVATE",
    items: [{ name: "Paper", quantity: 1, price: 25, costPrice: 1 }],
  };
  const result = mapOwnedOrders({ total: 1, items: [order] }, "42", 10, 0);
  assert.equal(result.items[0].items[0].unitPrice, 25);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.ok(!JSON.stringify(result).includes("costPrice"));
  assert.throws(() => mapOwnedOrders({ total: 1, items: [order] }, "99", 10, 0), denied(503));
});

test("only enabled, in-date, permitted customer-group offers are returned", () => {
  const offer = { name: "Group discount", enabled: true, amount: 10, discountType: "PERCENT", discountBase: "SUBTOTAL", triggers: { customerGroups: [5] } };
  assert.equal(pricingOffers([offer], customer).length, 1);
  assert.equal(pricingOffers([offer], { ...customer, customerGroupId: 7 }).length, 0);
  assert.equal(pricingOffers([{ ...offer, enabled: false }], customer).length, 0);
  assert.equal(pricingOffers([{ ...offer, triggers: { endDate: "2020-01-01" } }], customer).length, 0);
});

test("customer lookup requests exact email match and reports missing scopes explicitly", async () => {
  process.env.LIGHTSPEED_API_TOKEN = "fake-test-only-token";
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("email"), customer.email);
    assert.equal(url.searchParams.get("useExactEmailMatch"), "true");
    assert.equal(url.searchParams.get("limit"), "2");
    return new Response("forbidden", { status: 403 });
  };
  await assert.rejects(() => findCustomer("123", customer.email), (error: unknown) =>
    error instanceof AccountError && error.status === 503 && error.message.includes("read_customers"));
});

test("order queries always restrict customer ID and fail on upstream mismatch", async () => {
  process.env.LIGHTSPEED_API_TOKEN = "fake-test-only-token";
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("customerId"), "42");
    assert.equal(url.searchParams.get("offset"), "10");
    return Response.json({ total: 1, items: [{ customerId: 99 }] });
  };
  await assert.rejects(() => getOrders("123", "42", 10, 10), denied(503));
});
