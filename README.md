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

## Working with Replit and a local PC

GitHub is the hub. Your PC and Replit both push to and pull from this repo. Never copy files between them by hand.

- `main` is the stable branch that Replit deploys.
- Do each piece of work on its own branch (for example `dev/local-...` on the PC, `dev/replit-...` on Replit), then merge it into `main` with a pull request.
- Don't edit the same branch on both sides at once. When switching sides, push first, then pull on the other side.
- Before starting work: `git switch main`, `git pull`, then create or switch to your branch.
- After a merge, pull `main` on the other side. Run `pnpm install` if `pnpm-lock.yaml` changed (Replit does this automatically via `scripts/post-merge.sh`).
- Secrets stay separate: Replit Secrets on Replit, `.env` on the PC. Never commit keys.
- Keep the Replit files (`.replit`, `replit.md`, `artifacts/*/.replit-artifact/`) committed. Replit needs them, and they don't affect local runs.

Notes:

- Local runs use the same database and Lightspeed store as Replit when you copy Replit's `DATABASE_URL`, so treat test accounts and data with care. Don't send real inquiries or place orders while testing.
- Clerk sign-in on localhost needs the development keys (`pk_test_...` / `sk_test_...`).
