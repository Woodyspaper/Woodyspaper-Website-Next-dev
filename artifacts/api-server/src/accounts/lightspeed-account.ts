import { AccountError } from "./errors.ts";

export type ProviderCustomer = {
  id: number;
  email: string;
  name?: string;
  customerGroupId?: number;
  customerGroupName?: string;
  taxExempt?: boolean;
};
type ProviderOrder = {
  id: string | number; customerId: number; createDate: string; createTimestamp?: number;
  total: number; paymentStatus: string; fulfillmentStatus: string;
  items?: { name: string; quantity: number; price: number }[];
};
type Promotion = {
  name: string; enabled: boolean; amount: number; discountType: string; discountBase: string;
  triggers?: { customerGroups?: number[]; startDate?: string; endDate?: string; subtotal?: number; [key: string]: unknown };
  targets?: Record<string, unknown>;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Only the server's fresh Clerk user record can establish email ownership.
export function requireVerifiedLinkEmail(email: string, verifiedEmails: string[]) {
  const normalized = normalizeEmail(email);
  if (!normalized || !verifiedEmails.some(value => normalizeEmail(value) === normalized)) {
    throw new AccountError(403, "Verify this Lightspeed email with the code sent to that address before linking.");
  }
  return normalized;
}
export function lightspeedStoreId() {
  const id = process.env.LIGHTSPEED_STORE_ID || process.env.VITE_LIGHTSPEED_STORE_ID;
  return id && /^\d+$/.test(id) ? id : null;
}

async function providerGet<T>(storeId: string, path: string, params: URLSearchParams, scope: string): Promise<T> {
  const token = process.env.LIGHTSPEED_API_TOKEN;
  if (!token) throw new AccountError(503, "Lightspeed is not configured. Your website account is still available.");
  let response: Response;
  try {
    response = await fetch(`https://app.ecwid.com/api/v3/${encodeURIComponent(storeId)}/${path}?${params}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
  } catch { throw new AccountError(503, "Lightspeed could not be reached. Please try again later."); }
  if ([401, 403].includes(response.status)) {
    throw new AccountError(503, `Lightspeed has not granted ${scope} access. Please contact Woody’s Paper to enable this connection.`);
  }
  if (response.status === 404) throw new AccountError(409, "This Lightspeed customer is no longer available. Disconnect and link again, or contact Woody’s Paper.");
  if (!response.ok) throw new AccountError(503, "Lightspeed could not return account information. Please try again later.");
  try { return await response.json() as T; }
  catch { throw new AccountError(503, "Lightspeed returned an invalid response."); }
}

export function validateCustomer(customer: ProviderCustomer) {
  if (!customer || !Number.isSafeInteger(customer.id) || customer.id < 0 || typeof customer.email !== "string") {
    throw new AccountError(503, "Lightspeed returned an invalid customer record.");
  }
  return customer;
}

export function matchVerifiedCustomer(items: ProviderCustomer[], total: number, verifiedEmail: string) {
  if (!Array.isArray(items) || !Number.isSafeInteger(total) || total < 0) throw new AccountError(503, "Lightspeed returned an invalid customer list.");
  const matches = items.map(validateCustomer).filter(c => normalizeEmail(c.email) === normalizeEmail(verifiedEmail));
  if (!total || !matches.length) throw new AccountError(404, "No Lightspeed customer matches your verified website email. Use the email from your existing orders, or contact Woody’s Paper.");
  if (total !== 1 || matches.length !== 1) throw new AccountError(409, "More than one Lightspeed customer matches this email. Contact Woody’s Paper to resolve the duplicate records.");
  return matches[0];
}

export async function findCustomer(storeId: string, email: string) {
  const data = await providerGet<{ total: number; items: ProviderCustomer[] }>(storeId, "customers", new URLSearchParams({
    email, useExactEmailMatch: "true", limit: "2",
    responseFields: "total,items(id,email,name,customerGroupId,customerGroupName,taxExempt)",
  }), "read_customers");
  return matchVerifiedCustomer(data.items, data.total, email);
}

export async function getCustomer(storeId: string, id: string) {
  const customer = await providerGet<ProviderCustomer>(storeId, `customers/${encodeURIComponent(id)}`, new URLSearchParams({
    responseFields: "id,email,name,customerGroupId,customerGroupName,taxExempt",
  }), "read_customers");
  validateCustomer(customer);
  if (String(customer.id) !== id) throw new AccountError(503, "Lightspeed returned a different customer record.");
  return customer;
}

export function assertVerifiedLink(customer: ProviderCustomer, linkedEmail: string, verifiedEmails: string[]) {
  if (normalizeEmail(customer.email) !== normalizeEmail(linkedEmail) ||
      !verifiedEmails.map(normalizeEmail).includes(normalizeEmail(linkedEmail))) {
    throw new AccountError(409, "The linked email has changed or is no longer verified. Disconnect and link your Lightspeed account again.");
  }
}

export function linkedDisplayName(customer: ProviderCustomer, linkedEmail: string, verifiedEmails: string[], fallback: string) {
  assertVerifiedLink(customer, linkedEmail, verifiedEmails);
  return typeof customer.name === "string" && customer.name.trim() ? customer.name.trim() : fallback;
}

export function mapOwnedOrders(data: { total: number; items: ProviderOrder[] }, customerId: string, limit: number, offset: number) {
  if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 ||
      data.items.some(order => String(order.customerId) !== customerId)) {
    // Fail closed rather than leaking even one record if upstream ignores customerId.
    throw new AccountError(503, "Lightspeed returned orders that could not be verified for your account.");
  }
  const items = data.items.map(order => {
    if (!["string", "number"].includes(typeof order.id) || !Number.isFinite(order.total) ||
        typeof order.createDate !== "string" || typeof order.paymentStatus !== "string" ||
        typeof order.fulfillmentStatus !== "string" || !Array.isArray(order.items)) {
      throw new AccountError(503, "Lightspeed returned an incomplete order.");
    }
    return {
      id: String(order.id),
      createdAt: Number.isFinite(order.createTimestamp) ? new Date(order.createTimestamp! * 1000).toISOString() : order.createDate,
      total: order.total, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus,
      items: order.items.map(item => {
        if (typeof item.name !== "string" || !Number.isFinite(item.quantity) || !Number.isFinite(item.price)) throw new AccountError(503, "Lightspeed returned an incomplete order item.");
        return { name: item.name, quantity: item.quantity, unitPrice: item.price };
      }),
    };
  });
  return { items, total: data.total, limit, offset };
}

export async function getOrders(storeId: string, customerId: string, limit: number, offset: number) {
  const data = await providerGet<{ total: number; items: ProviderOrder[] }>(storeId, "orders", new URLSearchParams({
    customerId, limit: String(limit), offset: String(offset),
    responseFields: "total,items(id,customerId,createDate,createTimestamp,total,paymentStatus,fulfillmentStatus,items(name,quantity,price))",
  }), "read_orders");
  return mapOwnedOrders(data, customerId, limit, offset);
}

export function pricingOffers(promotions: Promotion[], customer: ProviderCustomer, now = Date.now()) {
  if (!Array.isArray(promotions)) throw new AccountError(503, "Lightspeed returned invalid pricing information.");
  return promotions.filter(p => {
    if (p.enabled !== true) return false;
    const t = p.triggers || {};
    if (t.customerGroups?.length && !t.customerGroups.includes(customer.customerGroupId ?? 0)) return false;
    if (t.startDate && (!Number.isFinite(Date.parse(t.startDate)) || Date.parse(t.startDate) > now)) return false;
    if (t.endDate && (!Number.isFinite(Date.parse(t.endDate)) || Date.parse(t.endDate) < now)) return false;
    return true;
  }).map(p => {
    if (typeof p.name !== "string" || !Number.isFinite(p.amount) || typeof p.discountType !== "string" || typeof p.discountBase !== "string") {
      throw new AccountError(503, "Lightspeed returned an incomplete pricing offer.");
    }
    return {
      name: p.name, amount: p.amount, discountType: p.discountType, appliesTo: p.discountBase,
      minimumSubtotal: typeof p.triggers?.subtotal === "number" ? p.triggers.subtotal : null,
      conditional: true,
    };
  });
}

export async function getPricing(storeId: string, customer: ProviderCustomer) {
  const data = await providerGet<{ items: Promotion[]; total: number }>(storeId, "promotions", new URLSearchParams({
    responseFields: "total,items(name,enabled,amount,discountType,discountBase,triggers,targets)",
  }), "read_promotion");
  if (!Array.isArray(data.items) || data.total !== data.items.length) {
    throw new AccountError(503, "The complete Lightspeed pricing list could not be loaded.");
  }
  return {
    groupName: customer.customerGroupName || "General",
    taxExempt: customer.taxExempt === true,
    offers: pricingOffers(data.items, customer),
    note: "These are available pricing offers for your customer group, subject to product, quantity, date and checkout conditions. Catalog prices remain public prices. Amounts are in the store’s currency. Sign in separately at Lightspeed checkout to receive confirmed customer pricing; discounts are not guaranteed or combined here.",
  };
}
