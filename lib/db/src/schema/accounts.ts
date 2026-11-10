import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// This ID, not an inventory provider's customer ID, owns the website account.
export const websiteAccounts = pgTable("website_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerAccountLinks = pgTable("provider_account_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => websiteAccounts.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  storeId: text("store_id").notNull(),
  customerId: text("customer_id").notNull(),
  verifiedEmail: text("verified_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("provider_customer_owner").on(table.provider, table.storeId, table.customerId),
  uniqueIndex("account_provider_store").on(table.accountId, table.provider, table.storeId),
]);
