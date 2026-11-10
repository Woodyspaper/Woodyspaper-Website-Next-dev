# Woody's Paper

Wholesale paper and packaging storefront for South Florida businesses, ported from the imported Next.js website without redesigning it.

## Run & Operate

- Start the managed workflow `artifacts/woodys-paper: web` to run the website.
- `pnpm --filter @workspace/woodys-paper run typecheck` — check the migrated frontend
- `pnpm --filter @workspace/woodys-paper test` — browser regression tests against the running workflow; inquiry delivery is intercepted, never sent
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Shared environment: `VITE_LIGHTSPEED_STORE_ID` (the public store ID, used by the storefront and API).
- Replit Secret: `LIGHTSPEED_API_TOKEN`, an Ecwid/Lightspeed API token with `read_catalog`, `read_customers`, `read_orders`, and `read_promotion` access. It is used only by the API server and never sent to the browser.
- Website authentication uses managed Clerk; configure it in the workspace Auth pane. Provider checkout sign-in remains separate.
- After changing Ecwid custom-app scopes, reinstall that custom app and replace the secret token; the old token is invalidated. Do not print tokens or customer data during permission checks.
- Configure both values through Replit's environment/secrets settings and restart the API server after changes. The API also accepts `LIGHTSPEED_STORE_ID` if you prefer a server-only store ID.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4
- API: Express 5, with the catalog endpoint defined in `lib/api-spec/openapi.yaml`
- Checkout/cart: existing external Lightspeed / Ecwid embed
- Website accounts: managed Clerk authentication plus stable internal UUIDs in PostgreSQL; optional provider links are stored separately. Linking and unlinking never replaces the website identity.
- The custom inventory page filters public Lightspeed categories, attributes, and product options before pagination. A complete catalog snapshot is cached for 60 seconds; hidden provider attributes are excluded. Size filtering prefers structured size values and otherwise extracts explicit dimensions from product names, normalizing mixed fractions and decimals. Unavailable size filters are hidden.
- Supply inquiries: existing FormSubmit endpoint with mailto fallback
- API/database packages power the public catalog and private account endpoints; account responses are private/no-store. Customer linking requires a verified website email and an exact provider match. Pricing offers are conditional; catalog prices remain public prices.

## Where things live

- `artifacts/woodys-paper/` — migrated website, served at `/`
- `artifacts/api-server/src/catalog/lightspeed.ts` — Lightspeed/Ecwid catalog adapter
- `artifacts/api-server/src/routes/catalog.ts` — `GET /api/catalog/products`
- `lib/api-spec/openapi.yaml` — catalog API contract and generated client source
- `.migration-backup/` — original imported sources, retained for reference and excluded from deployment

## Architecture decisions

- Keep the imported checkout and inquiry providers. Website accounts are independent of the inventory provider; do not use the embedded store’s localStorage customer data as authentication.
- Do not expose other customers’ orders or provider addresses, payment details, admin notes, or download links. Revalidate linked email ownership before reading provider data.
- Ecwid mutates page metadata and owns its hash routes. Keep description/social tags outside React ownership so store navigation cannot crash React.

## Product

- Home page with wholesale supply information and inquiry form; keep product browsing on `/inventory`. Global header search and the category navigation bar lead to inventory results.
- `/inventory` with API-backed product browsing, basic search and pagination; existing provider storefront remains available for checkout and customer accounts

## User preferences

All work stays in the development repository `Woodyspaper/Woodyspaper-Website-Next-dev`, branch `dev/inventory-backend`. Never push to the original `origin` repository. Preserve existing branding and public catalog behavior.

## Gotchas

- No storefront ID or public search token was included in the import. Do not invent them or substitute an unrelated store.
- Do not send real inquiry emails or place orders while testing; intercept third-party requests for those checks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
