import { clerkClient, getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, websiteAccounts, providerAccountLinks } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AccountError } from "./errors.ts";
import { lightspeedStoreId, normalizeEmail } from "./lightspeed-account.ts";

export type AccountIdentity = {
  accountId: string;
  authUserId: string;
  email: string;
  emailVerified: boolean;
  verifiedEmails: string[];
  displayName: string;
};

export async function loadIdentity(req: Request): Promise<AccountIdentity> {
  const { userId } = getAuth(req);
  if (!userId) throw new AccountError(401, "Sign in to your Woody’s Paper account.");
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
  const verifiedEmails = user.emailAddresses.filter(e => e.verification?.status === "verified").map(e => normalizeEmail(e.emailAddress));
  await db.insert(websiteAccounts).values({ clerkUserId: userId }).onConflictDoNothing({ target: websiteAccounts.clerkUserId });
  const [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.clerkUserId, userId)).limit(1);
  if (!account) throw new AccountError(503, "Your account could not be loaded. Please try again.");
  return {
    accountId: account.id, authUserId: userId, email: primary?.emailAddress || "",
    emailVerified: primary?.verification?.status === "verified", verifiedEmails,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Woody’s Paper customer",
  };
}

export async function accountResponse(identity: AccountIdentity) {
  const links = await db.select().from(providerAccountLinks).where(eq(providerAccountLinks.accountId, identity.accountId));
  return {
    id: identity.accountId, email: identity.email, emailVerified: identity.emailVerified, displayName: identity.displayName,
    activeLightspeedStoreId: lightspeedStoreId(),
    links: links.map(link => ({
      id: link.id, provider: link.provider, storeId: link.storeId,
      linkedEmail: link.verifiedEmail, createdAt: link.createdAt.toISOString(),
    })),
  };
}
