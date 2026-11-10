# Woody's Paper website

React + Vite storefront (`artifacts/woodys-paper`) and Express API (`artifacts/api-server`) in a pnpm workspace. It runs on Replit and on a local PC. See `replit.md` for architecture notes.

## Run locally (Windows, macOS, Linux)

1. Install [Node.js 24](https://nodejs.org/) and pnpm (`npm install -g pnpm`).
2. Copy the env template and fill it in from Replit -> Tools -> Secrets:

   ```bash
   cp .env.example .env
   ```

   (On Windows PowerShell: `copy .env.example .env`.)

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Start the API and the website together:

   ```bash
   pnpm dev
   ```

5. Open http://localhost:5173. The site forwards `/api/*` to the API on http://localhost:8080.

Useful commands:

- `pnpm run typecheck` - typecheck all packages
- `pnpm --filter @workspace/api-server test` - API unit tests

Notes:

- Local runs use the same database and Lightspeed store as Replit when you copy Replit's `DATABASE_URL`, so treat test accounts and data with care. Don't send real inquiries or place orders while testing.
- Clerk sign-in on localhost needs the development keys (`pk_test_...` / `sk_test_...`).
