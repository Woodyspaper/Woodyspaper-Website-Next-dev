import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, providerAccountLinks } from "@workspace/db";
import {
  GetAccountResponse, GetAccountPricingResponse, GetAccountOrdersResponse,
  GetAccountOrdersQueryParams, UnlinkProviderAccountParams,
} from "@workspace/api-zod";
import { accountResponse, loadIdentity, type AccountIdentity } from "../accounts/identity";
import { AccountError } from "../accounts/errors";
import { assertVerifiedLink, findCustomer, getCustomer, getOrders, getPricing, lightspeedStoreId, normalizeEmail } from "../accounts/lightspeed-account";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router = Router();
const attempts = new Map<string, { count: number; expires: number }>();
function linkRateLimit(userId: string) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires < now) attempts.delete(key);
  const current = attempts.get(userId) || { count: 0, expires: now + 60 * 60 * 1000 };
  if (current.count >= 10 || attempts.size >= 10000) throw new AccountError(429, "Too many linking attempts. Please try again in an hour.");
  current.count++;
  attempts.set(userId, current);
}

function fail(req: Request, res: Response, error: unknown) {
  if (error instanceof AccountError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // Do not log provider payloads, email addresses, credentials or customer/order data.
  req.log.error({ operation: "website-account" }, "Account operation failed");
  res.status(503).json({ error: "Your account service is temporarily unavailable. Please try again." });
}

router.use("/account", async (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  try {
    const origin = req.get("origin");
    const writes = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (req.get("sec-fetch-site") === "cross-site" || (writes && !origin)) throw new AccountError(403, "Please use the Woody’s Paper website to manage your account.");
    if (origin) {
      let host = "";
      try { host = new URL(origin).host; } catch { /* Invalid origin is rejected below. */ }
      if (!host || host !== getClerkProxyHost(req)) throw new AccountError(403, "This account request is not from the Woody’s Paper website.");
    }
    res.locals.identity = await loadIdentity(req);
    next();
  } catch (error) { fail(req, res, error); }
});

const identityOf = (res: Response) => res.locals.identity as AccountIdentity;
async function linkedCustomer(identity: AccountIdentity) {
  const storeId = lightspeedStoreId();
  if (!storeId) throw new AccountError(503, "Lightspeed is not configured. Your website account is still available.");
  const [link] = await db.select().from(providerAccountLinks).where(and(
    eq(providerAccountLinks.accountId, identity.accountId),
    eq(providerAccountLinks.provider, "lightspeed"),
    eq(providerAccountLinks.storeId, storeId),
  )).limit(1);
  if (!link) throw new AccountError(409, "Link your Lightspeed account to view pricing and order history.");
  const customer = await getCustomer(storeId, link.customerId);
  assertVerifiedLink(customer, link.verifiedEmail, identity.verifiedEmails);
  return { link, customer };
}

router.get("/account", async (req, res) => {
  try { res.json(GetAccountResponse.parse(await accountResponse(identityOf(res)))); }
  catch (error) { fail(req, res, error); }
});

router.post("/account/links/lightspeed", async (req, res) => {
  try {
    const identity = identityOf(res);
    if (!identity.emailVerified || !identity.email) throw new AccountError(403, "Verify your primary website email before linking Lightspeed.");
    if (req.body && Object.keys(req.body).length) throw new AccountError(400, "Linking uses your verified website email only. Do not supply a customer ID.");
    linkRateLimit(identity.authUserId);
    const storeId = lightspeedStoreId();
    if (!storeId) throw new AccountError(503, "Lightspeed is not configured.");
    const customer = await findCustomer(storeId, identity.email);
    const conditions = and(
      eq(providerAccountLinks.accountId, identity.accountId),
      eq(providerAccountLinks.provider, "lightspeed"),
      eq(providerAccountLinks.storeId, storeId),
    );
    const [existing] = await db.select().from(providerAccountLinks).where(conditions).limit(1);
    if (existing && (existing.customerId !== String(customer.id) || normalizeEmail(existing.verifiedEmail) !== normalizeEmail(identity.email))) {
      throw new AccountError(409, "Disconnect the existing Lightspeed link before linking another customer.");
    }
    if (!existing) {
      try {
        await db.insert(providerAccountLinks).values({
          accountId: identity.accountId, provider: "lightspeed", storeId,
          customerId: String(customer.id), verifiedEmail: normalizeEmail(identity.email),
        });
      } catch (error) {
        const e = error as { code?: string; cause?: { code?: string } };
        if (e.code === "23505" || e.cause?.code === "23505") throw new AccountError(409, "This customer is already linked. Refresh your account or contact Woody’s Paper.");
        throw error;
      }
    }
    res.json(GetAccountResponse.parse(await accountResponse(identity)));
  } catch (error) { fail(req, res, error); }
});

router.delete("/account/links/:linkId", async (req, res) => {
  try {
    const params = UnlinkProviderAccountParams.safeParse(req.params);
    if (!params.success) throw new AccountError(400, "Invalid account link.");
    const rows = await db.delete(providerAccountLinks).where(and(
      eq(providerAccountLinks.id, params.data.linkId),
      eq(providerAccountLinks.accountId, identityOf(res).accountId),
    )).returning({ id: providerAccountLinks.id });
    if (!rows.length) throw new AccountError(404, "Account link not found.");
    res.status(204).end();
  } catch (error) { fail(req, res, error); }
});

router.get("/account/lightspeed/pricing", async (req, res) => {
  try {
    const { link, customer } = await linkedCustomer(identityOf(res));
    res.json(GetAccountPricingResponse.parse(await getPricing(link.storeId, customer)));
  } catch (error) { fail(req, res, error); }
});

router.get("/account/lightspeed/orders", async (req, res) => {
  try {
    const query = GetAccountOrdersQueryParams.safeParse(req.query);
    if (!query.success) throw new AccountError(400, "Invalid order page.");
    const { link } = await linkedCustomer(identityOf(res));
    res.json(GetAccountOrdersResponse.parse(await getOrders(link.storeId, link.customerId, query.data.limit, query.data.offset)));
  } catch (error) { fail(req, res, error); }
});

export default router;
