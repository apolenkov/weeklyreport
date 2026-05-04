---
name: CustomReport E2E test setup gotchas
description: How to run integration suite (Prisma consent + NEXT_DIST_DIR + .env.test). What journey vs integration config covers
type: reference
originSessionId: 3069f89c-564f-44b5-9a43-9a887bbfa820
---
# CustomReport E2E setup

Two Playwright configs live in `apps/web/`:

- **`playwright.config.ts`** — journey suite. Runs against in-memory mocks + dev DB on ports 3100/3101. Uses `NEXT_DIST_DIR=.next-e2e` to coexist with user's `pnpm dev`. Single project: `chromium` (Desktop Chrome).
- **`playwright.integration.config.ts`** — integration suite. Real API + real Postgres on ports 3002/3005. Three projects: `chromium-integration` + `mobile-ios` (iPhone 14, 390x844) + `mobile-android` (Pixel 7, 412x915). Requires `E2E_DATABASE_URL` from `.env.test`. Global setup runs `prisma migrate reset --force` + `prisma db seed`.

**To run integration suite locally:**

```bash
NEXT_DIST_DIR=.next-e2e env $(grep -v '^#' .env.test | xargs) PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да pnpm --filter @customreport/web exec playwright test --config=playwright.integration.config.ts
```

The Prisma 7 AI-safety guard requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env with the user's exact consent text — explicit "да" or "yes" from user, then pass through. Only OK against `customreport_e2e` (dedicated E2E DB), NEVER against dev `customreport` or production.

**Why NEXT_DIST_DIR=.next-e2e:** Next.js 16 turbopack fingerprints dev process by repo dir + .next. Without override, integration's `next dev` refuses to start when user's `pnpm dev` is running on :3000. Integration config DOES NOT set this internally — must pass via env.

**Seed leads (in customreport_e2e + dev):**
- `platanov@customreport.local` — Dev Lead, **submitted** (form locked)
- `olga@customreport.local` — Dev Lead, **draft with 2 items** (best for testing CRUD)
- `sergey@customreport.local` — Dev Lead, draft empty
- `maria@customreport.local`, `igor@customreport.local`, `dmitry@customreport.local`
- `head@customreport.local`, `viewer@customreport.local`

For mobile audit / dialog testing — **use Olga**. Platanov is submitted so all "+ Add" buttons hide and form is read-only.
