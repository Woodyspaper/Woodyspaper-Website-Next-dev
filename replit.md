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
- Replit Secret: `LIGHTSPEED_API_TOKEN`, an Ecwid/Lightspeed API token with `read_catalog` access. It is used only by the API server and never sent to the browser.
- Configure both values through Replit's environment/secrets settings and restart the API server after changes. The API also accepts `LIGHTSPEED_STORE_ID` if you prefer a server-only store ID.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4
- API: Express 5, with the catalog endpoint defined in `lib/api-spec/openapi.yaml`
- Store, cart, and customer accounts: existing external Lightspeed / Ecwid embed
- The custom inventory page fetches product data through the API server's Lightspeed adapter. Search and pagination are backend-driven; provider-specific filters are deferred.
- Supply inquiries: existing FormSubmit endpoint with mailto fallback
- The scaffold API/database packages are not used by this frontend-only website.

## Where things live

- `artifacts/woodys-paper/` — migrated website, served at `/`
- `artifacts/api-server/src/catalog/lightspeed.ts` — Lightspeed/Ecwid catalog adapter
- `artifacts/api-server/src/routes/catalog.ts` — `GET /api/catalog/products`
- `lib/api-spec/openapi.yaml` — catalog API contract and generated client source
- `.migration-backup/` — original imported sources, retained for reference and excluded from deployment

## Architecture decisions

- Keep the imported store and inquiry providers rather than replacing them or introducing a new database.
- Ecwid mutates page metadata and owns its hash routes. Keep description/social tags outside React ownership so store navigation cannot crash React.

## Product

- Home page with wholesale supply information, inventory preview, and inquiry form
- `/inventory` with API-backed product browsing, basic search and pagination; existing provider storefront remains available for checkout and customer accounts

## User preferences

Preserve the original app; this migration does not add features.

## Gotchas

- No storefront ID or public search token was included in the import. Do not invent them or substitute an unrelated store.
- Do not send real inquiry emails or place orders while testing; intercept third-party requests for those checks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
