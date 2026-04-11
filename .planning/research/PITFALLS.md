# Domain Pitfalls

**Domain:** Adding shadcn/ui, Playwright E2E, Next.js 15 to 16 migration, pgvector RAG to existing CustomReport monorepo
**Researched:** 2026-04-11
**Scope:** Integration pitfalls when adding features to an existing Next.js 15 + NestJS + Prisma 7 + Turborepo system

## Critical Pitfalls

Mistakes that cause rewrites, multi-day debugging, or broken production deploys.

### Pitfall 1: shadcn/ui Tailwind Classes Invisible in Consuming App

**What goes wrong:** You install shadcn/ui components in `packages/ui`, import
them in `apps/web`, and the components render with zero styling -- raw HTML
elements without any Tailwind CSS applied. The components "work" but look
completely broken.

**Why it happens:** Tailwind v4 uses `@source` directives in the main CSS file
to discover which files to scan for class names. If the CSS file in `apps/web`
does not include an `@source` directive pointing to `../../packages/ui/src/**`,
Tailwind never sees the classes used in the shared UI package. Additionally,
Next.js must be configured with `transpilePackages: ['@customreport/ui']` so it
processes the TypeScript/CSS from the workspace package rather than treating it
as a pre-compiled dependency.

**Consequences:**
- All 22+ components render unstyled
- Developers waste hours checking import paths when the real problem is Tailwind
  scanning scope
- PDF export will generate unstyled HTML, producing garbage output

**Prevention:**
1. The main `globals.css` in `apps/web` must include `@source` for the UI
   package path: `@source "../../packages/ui/src/**/*.{ts,tsx}"`
2. Add `transpilePackages: ['@customreport/ui']` to `next.config.ts`
3. Validate by running `pnpm --filter @customreport/web dev` and inspecting a
   single Button component before proceeding with bulk component migration
4. The `packages/ui` workspace should own the `globals.css` with design tokens
   and `@theme` directives; `apps/web` should `@import` it

**Detection:** After adding the first shadcn/ui component, visually inspect it
in the browser. If the Button has no background color or border-radius, the
source scanning is broken.

**Confidence:** HIGH -- multiple Turborepo + shadcn/ui guides document this
exact issue.

### Pitfall 2: Next.js 16 middleware.ts Silently Ignored

**What goes wrong:** After upgrading to Next.js 16, the authentication
middleware in `apps/web/src/middleware.ts` stops running entirely. All protected
routes (`/lead`, `/head`, `/admin`, `/reports`) become accessible without any
authentication check. No error is thrown -- the middleware file is simply
ignored.

**Why it happens:** Next.js 16 renames the middleware file convention to
`proxy.ts` (or `proxy.js`). The exported function must also be renamed from
`middleware` to `proxy`. The old `middleware.ts` file is deprecated and silently
skipped. The existing middleware in this project handles auth cookie validation
and SAML redirect -- a critical security boundary.

**Consequences:**
- Authentication bypass in production -- anyone can access protected routes
- The `AUTH_DEV_MODE` guard becomes the only protection (and it also skips auth
  in non-production)
- SAML redirect flow breaks silently -- users see raw unauthenticated pages
  instead of being sent to Keycloak

**Prevention:**
1. Rename `apps/web/src/middleware.ts` to `apps/web/src/proxy.ts`
2. Rename the exported function from `middleware` to `proxy`
3. Update all imports and tests that reference the middleware module
4. Use the codemod: `npx @next/codemod@canary middleware-to-proxy .`
5. Verify by hitting a protected route (`/lead/report`) in an incognito window
   -- must redirect to Keycloak login

**Detection:** After upgrade, open `/lead/report` in incognito browser. If the
page loads without redirect to `/auth/saml/login`, the proxy is not running.

**Confidence:** HIGH -- confirmed breaking change in Next.js 16 official docs.

### Pitfall 3: Prisma 7 Migration Drift with pgvector Unsupported Type

**What goes wrong:** You add a vector column to the Prisma schema using
`Unsupported("vector(1536)")`, run `prisma migrate dev`, and get a drift
detection error: "Altered column 'embedding' (type changed)" -- even though
nothing actually changed. Every subsequent `migrate dev` reports the same drift,
making the migration workflow unusable.

**Why it happens:** Prisma 7.0-7.1 has a known bug where the
`Unsupported("vector")` type without explicit dimensions in the migration file
conflicts with the actual database column that has dimensions (e.g.,
`vector(1536)`). Prisma's introspection sees a type mismatch between the
migration history and the live database.

**Consequences:**
- `prisma migrate dev` fails on every run, blocking all schema changes
- CI/CD pipelines that run migrations break
- Developers resort to `--force` flag, which can cause data loss
- The "drift" error erodes trust in the migration system

**Prevention:**
1. Use Prisma 7.2.0+ (the drift bug was fixed in 7.2.0)
2. Use `--create-only` flag when adding vector columns: `prisma migrate dev
   --create-only --name add_embeddings`
3. Edit the generated migration SQL to explicitly include dimensions:
   `CREATE EXTENSION IF NOT EXISTS vector;` then
   `ALTER TABLE "ReportSection" ADD COLUMN "embedding" vector(1536);`
4. Never rely on `Unsupported("vector")` alone -- always pair with a hand-edited
   migration file
5. Add the pgvector extension creation to the very first line of the migration
   (before any table that uses the type)

**Detection:** Run `prisma migrate dev` after adding a vector column. If you see
"Drift detected" with no actual schema changes, you have hit this bug.

**Confidence:** HIGH -- confirmed bug in prisma/prisma#28867, fixed in 7.2.0.

### Pitfall 4: Playwright storageState Auth Desync Between Web and API

**What goes wrong:** E2E tests authenticate once in global setup and save
cookies to `storageState`. Tests start passing initially, but then randomly fail
with "Unauthorized" responses from the API, or fail consistently after a certain
number of tests.

**Why it happens:** The project uses JWT tokens with a 1-hour expiry (per
CLAUDE.md security defaults). If the E2E test suite runs longer than the token
lifetime, later tests use expired tokens from the saved storageState. In
parallel mode, multiple workers sharing the same storageState file can also
cause race conditions. Additionally, the existing `AUTH_DEV_MODE` bypass in the
current middleware skips auth in non-production BUT the API side also checks
`AUTH_DEV_MODE` -- if these get out of sync (web bypass + API enforce), tests
break.

**Consequences:**
- Flaky tests that pass locally (short run) but fail in CI (full suite)
- False negatives that erode confidence in the test suite
- Hours spent debugging "intermittent auth failures" that are actually token
  expiry

**Prevention:**
1. Use a dedicated `auth.setup.ts` file that generates fresh JWT tokens per
   worker, not a single shared storageState
2. Set JWT token lifetime to 24h in test environment (via `AUTH_JWT_EXPIRY`
   env var)
3. Ensure `AUTH_DEV_MODE=true` is set consistently in BOTH `apps/web` and
   `apps/api` .env.test files
4. For parallel workers, use worker-scoped auth fixtures with `parallelIndex`
   to prevent file contention
5. Add the `playwright/.auth/` directory to `.gitignore`

**Detection:** Run the full E2E suite 3 times in sequence. If later tests fail
with 401 responses that pass when run individually, token expiry is the cause.

**Confidence:** HIGH -- standard Playwright auth pattern, confirmed by official
docs and community guides.

### Pitfall 5: Turbopack Default Breaks Build in Next.js 16

**What goes wrong:** After upgrading to Next.js 16, `next build` fails with
cryptic errors about unsupported webpack configuration or missing loaders. The
existing `output: 'standalone'` config in `next.config.ts` may also behave
differently.

**Why it happens:** Next.js 16 makes Turbopack the default bundler for both
`next dev` AND `next build`. If the project has any webpack-specific
configuration (custom loaders, plugins, or module resolution rules), Turbopack
will reject them. The current `next.config.ts` is minimal (`reactStrictMode` +
`output: 'standalone'`), but any future additions or dependencies that rely on
webpack internals will fail.

**Consequences:**
- Production builds break with no clear error pointing to Turbopack
- Docker builds fail (the Dockerfiles use `next build`)
- CI/CD pipeline breaks

**Prevention:**
1. Before upgrading, test `next build --turbopack` on Next.js 15 to identify
   incompatibilities early
2. The current minimal config should work with Turbopack, but verify
   `output: 'standalone'` produces the same Docker-compatible output
3. If Turbopack issues arise, add `--webpack` flag to build scripts as a
   temporary escape hatch
4. Check all dependencies for webpack-specific requirements (especially
   Playwright for PDF generation if it uses any webpack plugins)

**Detection:** Run `pnpm --filter @customreport/web build` after upgrade. If it
fails, check if `--webpack` flag fixes it -- that confirms Turbopack
incompatibility.

**Confidence:** MEDIUM-HIGH -- the current config is minimal and likely
compatible, but `output: 'standalone'` behavior with Turbopack needs
verification.

## Moderate Pitfalls

### Pitfall 6: shadcn/ui components.json Misalignment Between Workspaces

**What goes wrong:** Components install to wrong directories, or imports break
because `packages/ui/components.json` and `apps/web/components.json` have
different `style`, `iconLibrary`, or `baseColor` settings.

**Prevention:**
1. Both `components.json` files must share identical `style`, `iconLibrary`,
   and `baseColor` values
2. The `aliases` section differs (correctly) between workspaces -- `packages/ui`
   uses `@workspace/ui/*` paths while `apps/web` uses `@/*` for local
   components
3. For Tailwind v4, leave the `tailwind.config` field empty in both
   `components.json` files -- v4 uses CSS-first configuration
4. Always run `shadcn add` from `apps/web/` directory, never from monorepo root

**Detection:** After `shadcn add button`, check that the file lands in
`packages/ui/src/components/button.tsx`, not in `apps/web/src/components/`.

**Confidence:** HIGH -- documented in shadcn/ui monorepo guide.

### Pitfall 7: next lint Removal Breaks CI Pipeline

**What goes wrong:** After upgrading to Next.js 16, the `next lint` command no
longer exists. CI pipelines, pre-commit hooks, and `package.json` scripts that
reference `next lint` fail with "command not found" or similar errors.
Additionally, `next build` no longer runs linting automatically.

**Prevention:**
1. Replace all `next lint` references with direct `eslint .` commands BEFORE
   upgrading
2. Use the codemod: `npx @next/codemod@canary next-lint-to-eslint-cli`
3. Update `apps/web/package.json` lint script from any `next lint` usage to
   `eslint .` (the current project uses `tsc --noEmit` for lint, so this may
   not apply directly, but verify)
4. Migrate from `.eslintrc` to ESLint flat config format (`eslint.config.js`)
   since `@next/eslint-plugin-next` now defaults to flat config
5. Update the `eslint` option in `next.config.ts` -- it has been removed in
   Next.js 16

**Detection:** Run `pnpm --filter @customreport/web lint` after upgrade. If it
references `next lint` anywhere in the chain, it will fail.

**Confidence:** HIGH -- confirmed removal in Next.js 16 release notes.

### Pitfall 8: pgvector HNSW Index Not Used Due to Distance Metric Mismatch

**What goes wrong:** You create an HNSW index for vector similarity search, but
queries remain slow -- the index is silently ignored by PostgreSQL.

**Prevention:**
1. The index distance operator MUST match the query distance operator:
   - Cosine: `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)` pairs
     with `<=>` operator
   - L2: `CREATE INDEX ... USING hnsw (embedding vector_l2_ops)` pairs with
     `<->` operator
   - Inner product: `vector_ip_ops` pairs with `<#>` operator
2. Pick one distance metric (cosine is standard for text embeddings) and use it
   consistently in both index creation and all `$queryRaw` calls
3. Create indexes with `CONCURRENTLY` to avoid blocking writes -- but this
   requires a non-transactional migration (add `-- AlterTable` comment or
   handle separately)
4. Prisma cannot create HNSW indexes natively -- must be added via custom SQL
   in migration files

**Detection:** Run `EXPLAIN ANALYZE` on a vector query. If the plan shows
"Seq Scan" instead of "Index Scan using hnsw_index", the index is not being
used.

**Confidence:** HIGH -- well-documented PostgreSQL/pgvector behavior.

### Pitfall 9: Async Request APIs Break Existing Pages in Next.js 16

**What goes wrong:** Pages that access `params` or `searchParams`
synchronously stop working. Components that use `cookies()` or `headers()`
synchronously throw runtime errors.

**Why it happens:** Next.js 15 introduced async request APIs with temporary
synchronous compatibility. Next.js 16 removes the synchronous fallback
entirely. All access to `params`, `searchParams`, `cookies()`, and `headers()`
must be `await`-ed.

**Prevention:**
1. Before upgrading, grep for synchronous usage:
   `grep -r "params\." apps/web/src/app/ --include="*.tsx" --include="*.ts"`
2. Run the codemod: `npx @next/codemod@canary next-async-request-api .`
3. Update all dynamic route pages: `params` must be awaited
4. Update all pages using `searchParams`: must be awaited
5. Update any server-side code calling `cookies()` or `headers()` without await

**Detection:** After upgrade, runtime errors like "Cannot read property of
Promise" or "params is a Promise, not an object" indicate synchronous access.

**Confidence:** HIGH -- mandatory breaking change, well-documented.

### Pitfall 10: Playwright E2E Tests Fragile Without Proper Selectors

**What goes wrong:** E2E tests pass initially but break after any UI styling
changes because they rely on DOM structure, CSS classes, or text content that
changes during the shadcn/ui migration.

**Why it happens:** The existing E2E tests use `getByRole` and `getByLabel`
(good), but also `getByText` with Russian strings that may change during
redesign. During the shadcn/ui migration, component structure changes
(e.g., `<select>` becomes shadcn's `<Select>` with different ARIA roles),
breaking role-based selectors too.

**Prevention:**
1. Add `data-testid` attributes to all interactive elements during the
   shadcn/ui migration -- these survive restyling
2. Review all 7 existing E2E spec files after shadcn/ui component migration
3. Update selectors that rely on native HTML elements (e.g.,
   `getByRole('option')`) to match shadcn/ui's Radix-based primitives
   (`getByRole('menuitem')` or similar)
4. Run E2E suite after each component batch migration, not only at the end

**Detection:** Run `pnpm exec playwright test` after each batch of component
changes. Failures in seemingly unrelated tests indicate selector breakage.

**Confidence:** MEDIUM-HIGH -- depends on how much component structure changes.

### Pitfall 11: Tailwind v4 Migration Breaks tailwindcss-animate

**What goes wrong:** After setting up Tailwind v4 with shadcn/ui, animation
classes (used by shadcn/ui Dialog, Dropdown, Tooltip, etc.) do not work. The
`tailwindcss-animate` plugin is incompatible with Tailwind v4.

**Prevention:**
1. Remove `tailwindcss-animate` from dependencies
2. Install `tw-animate-css` instead: `pnpm add -D tw-animate-css`
3. In `globals.css`, replace `@plugin 'tailwindcss-animate'` with
   `@import "tw-animate-css"`
4. This applies to `packages/ui` since it owns the global styles

**Detection:** Open a shadcn Dialog or Dropdown. If there is no fade/slide
animation on open/close, the animate plugin is misconfigured.

**Confidence:** HIGH -- documented in shadcn/ui Tailwind v4 migration guide.

## Minor Pitfalls

### Pitfall 12: pgvector Extension Not Available in Docker Image

**What goes wrong:** `CREATE EXTENSION vector` fails in the PostgreSQL Docker
container used for local development and CI.

**Prevention:**
1. Use the `pgvector/pgvector:pg15` Docker image instead of the standard
   `postgres:15` image in `docker-compose.dev.yml` and `docker-compose.yml`
2. Alternatively, install the extension in a custom Dockerfile:
   `RUN apt-get update && apt-get install -y postgresql-15-pgvector`
3. Update the CI pipeline to use the pgvector image as well
4. The production PostgreSQL must also have pgvector installed (check with
   cloud provider if using managed PostgreSQL)

**Detection:** `prisma migrate dev` fails with "ERROR: could not open extension
control file pgvector" or similar.

**Confidence:** HIGH -- standard Docker/PostgreSQL configuration.

### Pitfall 13: pnpm Workspace Resolution Breaks shadcn CLI

**What goes wrong:** Running `pnpm dlx shadcn@latest add button` from
`apps/web/` fails with module resolution errors because the shadcn CLI cannot
find the `packages/ui` workspace package.

**Prevention:**
1. Initialize shadcn with `pnpm dlx shadcn@latest init --monorepo` if starting
   fresh
2. Ensure `pnpm-workspace.yaml` correctly lists both `apps/*` and `packages/*`
3. The `components.json` in `apps/web` must have the correct relative path to
   `packages/ui` CSS file: `"css": "../../packages/ui/src/styles/globals.css"`
4. If the CLI fails, install components manually by copying from the shadcn/ui
   source and adapting imports

**Detection:** CLI error during `shadcn add` with messages about missing
modules or unresolved paths.

**Confidence:** MEDIUM -- depends on exact shadcn CLI version and pnpm version.

### Pitfall 14: Node.js Version Requirement Bump in Next.js 16

**What goes wrong:** CI or Docker builds fail because the environment runs
Node.js 18.x, which is no longer supported by Next.js 16.

**Prevention:**
1. Next.js 16 requires Node.js 20.9.0 minimum
2. Update `engines.node` in root `package.json` from `>=20.0.0` to `>=20.9.0`
3. Update Dockerfiles (`Dockerfile.web`, `Dockerfile.api`) to use
   `node:20-alpine` or `node:22-alpine`
4. Update CI workflow Node.js matrix to drop 18.x if present

**Detection:** Build error mentioning unsupported Node.js version.

**Confidence:** HIGH -- explicit requirement in Next.js 16 release notes.

### Pitfall 15: Raw SQL Queries for pgvector Bypass Prisma Type Safety

**What goes wrong:** All vector operations must use `$queryRaw` or
`$executeRaw` because Prisma does not natively support the vector type. This
creates a type-safety gap in an otherwise fully type-safe tRPC + Zod + Prisma
stack.

**Prevention:**
1. Use TypedSQL (Prisma's `$queryRawTyped`) where available to retain some
   type safety
2. Create a dedicated `VectorRepository` service that encapsulates all raw SQL
   vector operations behind a typed interface
3. Use the `pgvector` npm package's `toSql()` method for proper vector
   serialization -- do not hand-build SQL strings with array concatenation
4. Write unit tests for every raw SQL query with known input/output pairs
5. Wrap all vector operations in a Zod schema that validates dimensions match
   the model (e.g., 1536 for OpenAI `text-embedding-3-small`)

**Detection:** TypeScript compilation succeeds but runtime errors occur with
"invalid vector literal" or dimension mismatch errors.

**Confidence:** HIGH -- fundamental Prisma limitation with pgvector.

### Pitfall 16: Cache Behavior Change Affects Data Fetching

**What goes wrong:** After upgrading to Next.js 16, pages that previously
showed cached data now always fetch fresh data on every request, causing
performance degradation. Or conversely, pages expected to be dynamic are
accidentally cached.

**Prevention:**
1. Next.js 16 makes all caching opt-in via `'use cache'` directive -- nothing
   is cached by default
2. Audit all pages and API routes for caching expectations
3. For the report listing page, add explicit `'use cache'` if static generation
   is desired
4. The report editing pages should remain dynamic (no cache) -- this is now the
   default, so no change needed
5. Review `revalidateTag()` / `updateTag()` usage if any cache invalidation
   patterns were set up

**Detection:** Page load times increase significantly for read-heavy pages
(report history, published reports) after upgrade.

**Confidence:** MEDIUM -- depends on whether the project relies on implicit
caching behavior.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| shadcn/ui setup in monorepo | Tailwind classes not scanning packages/ui (P1) | Set up @source directive and transpilePackages before any component work |
| shadcn/ui component migration | Playwright selectors break (P10) | Add data-testid during migration, run E2E after each batch |
| shadcn/ui animations | tailwindcss-animate incompatible with v4 (P11) | Use tw-animate-css from day one |
| Playwright E2E auth setup | Token expiry in long suites (P4) | Use per-worker auth fixtures, extend JWT lifetime in test env |
| Playwright E2E selectors | Selectors break after shadcn migration (P10) | Do shadcn/ui migration BEFORE writing new E2E tests |
| Next.js 15 to 16 upgrade | middleware.ts silently ignored (P2) | Rename to proxy.ts as first upgrade step |
| Next.js 15 to 16 upgrade | Async request APIs mandatory (P9) | Run codemod before manual review |
| Next.js 15 to 16 upgrade | next lint removed (P7) | Replace with ESLint CLI before upgrade |
| Next.js 15 to 16 upgrade | Turbopack default (P5) | Test --turbopack flag on Next.js 15 first |
| pgvector schema addition | Migration drift with Unsupported type (P3) | Use Prisma 7.2.0+, --create-only + hand-edit SQL |
| pgvector Docker setup | Extension not in standard image (P12) | Switch to pgvector/pgvector Docker image |
| pgvector query layer | Type safety gap with raw SQL (P15) | Create VectorRepository with typed interface |
| pgvector index creation | HNSW index silently unused (P8) | Match distance operator in index and query |

## Recommended Phase Ordering Based on Pitfalls

The pitfalls above strongly suggest this execution order:

1. **Next.js 16 upgrade FIRST** -- because it changes fundamental file
   conventions (middleware to proxy) and API patterns (async params) that
   affect all subsequent work. Doing the upgrade after shadcn/ui migration
   would mean redoing selectors and potentially breaking newly styled pages.

2. **shadcn/ui + Tailwind v4 setup SECOND** -- after the framework is stable
   on Next.js 16, set up the UI infrastructure. The setup pitfalls (P1, P6,
   P11, P13) are all configuration issues that should be resolved once before
   any component work begins.

3. **Playwright E2E THIRD** -- write E2E tests AFTER the UI is styled and
   stable. Writing tests on unstyled components means rewriting selectors
   after shadcn/ui migration. The auth pitfalls (P4) should be solved during
   setup, not discovered during test authoring.

4. **pgvector RAG LAST** -- this is the most isolated feature with its own
   database migration (P3, P12), Docker image changes (P12), and raw SQL
   layer (P15). It does not depend on UI or E2E infrastructure.

## Sources

- [shadcn/ui Monorepo Guide](https://ui.shadcn.com/docs/monorepo)
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
- [Turborepo shadcn/ui Guide](https://turborepo.dev/docs/guides/tools/shadcn-ui)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Next.js 16 middleware-to-proxy](https://nextjs.org/docs/messages/middleware-to-proxy)
- [Next.js 16 Migration Walkthrough](https://www.salmanizhar.com/blog/nextjs-16-migration-guide)
- [Next.js 16 Lint Removal Fix](https://zenn.dev/ykbone/articles/2acd8e02d35492?locale=en)
- [Playwright Authentication Docs](https://playwright.dev/docs/auth)
- [Playwright Auth Patterns (Checkly)](https://www.checklyhq.com/docs/learn/playwright/authentication/)
- [SAML with Playwright (Hoop.dev)](https://hoop.dev/blog/the-simplest-way-to-make-playwright-saml-work-like-it-should)
- [Advanced Playwright Multi-Role Auth](https://medium.com/@faizan4199/advanced-playwright-authentication-a-multi-role-fixture-for-scalable-e2e-testing-9ce89af14223)
- [Prisma pgvector Drift Bug #28867](https://github.com/prisma/prisma/issues/28867) -- fixed in 7.2.0
- [Prisma pgvector HNSW Index Issue #21850](https://github.com/prisma/prisma/issues/21850)
- [Prisma Postgres Extensions Docs](https://www.prisma.io/docs/postgres/database/postgres-extensions)
- [pgvector Atlas Index Guide](https://atlasgo.io/guides/orms/prisma/vector-index)
- [pgvector npm Package](https://www.npmjs.com/package/pgvector)
- [Railway pgvector Hosting Guide](https://blog.railway.com/p/hosting-postgres-with-pgvector)
