# Technology Stack: v3.0 UI Polish & Analytics

**Project:** CustomReport
**Milestone:** v3.0 UI Polish & Analytics
**Researched:** 2026-04-11
**Overall confidence:** HIGH (versions verified against npm registry April 11 2026)

---

## Scope

This document covers ONLY the new libraries, version upgrades, and integration
patterns needed for the v3.0 milestone. It does NOT re-research the base stack
validated in v1.0/v2.0 (NestJS 11, Prisma 7, Zod 4, tRPC 11, BullMQ,
Docker Compose, SAML auth, PgBouncer).

**v3.0 adds six capability areas:**

1. shadcn/ui + Tailwind CSS v4 styling (22 components, 7+ pages, PDF report)
2. Playwright E2E tests (full user journey)
3. Next.js 15 -> 16 migration
4. Vitest 3 -> 4 migration
5. ESLint 9 -> 10 migration + pnpm 9 -> 10 migration
6. pgvector RAG analytics (embeddings, chatbot, trends)

---

## 1. shadcn/ui + Tailwind CSS v4

### Current State

- `packages/ui/package.json` exists with React 19 dependency but NO shadcn/ui
  components, no Tailwind CSS, no PostCSS config, no CSS files anywhere
- `apps/web/` has no CSS files, no `tailwind.config.*`, no `postcss.config.*`
- The codebase has 22 React components with inline styling or bare HTML

### Recommended Stack

| Package | Version | Install Location | Purpose |
|---------|---------|-----------------|---------|
| `tailwindcss` | `^4.2.2` | `packages/ui` + `apps/web` | Utility-first CSS framework (v4 uses CSS-first config) |
| `@tailwindcss/postcss` | `^4.2.2` | `apps/web` | PostCSS plugin for Next.js integration |
| `postcss` | `^8.5.0` | `apps/web` | PostCSS engine (peer dependency) |
| `tw-animate-css` | `^1.4.0` | `packages/ui` | Animation utilities for shadcn/ui (replaces deprecated `tailwindcss-animate`) |
| `class-variance-authority` | `^0.7.0` | `packages/ui` | Component variant API (required by shadcn/ui) |
| `clsx` | `^2.1.0` | `packages/ui` | Conditional className utility |
| `tailwind-merge` | `^3.0.0` | `packages/ui` | Merge Tailwind classes without conflicts |
| `lucide-react` | `^0.500.0` | `packages/ui` | Icon set (default for shadcn/ui) |

### Why Tailwind v4 (not v3)

Tailwind v4 is the current stable release (4.2.2). Key differences from v3:

- **CSS-first configuration**: No `tailwind.config.js` needed. Configuration
  lives in CSS via `@theme` directive
- **OKLCH color space**: HSL variables replaced by OKLCH for perceptually
  uniform colors
- **`@import "tailwindcss"`**: Single CSS import replaces `@tailwind base/
  components/utilities`
- **Faster compilation**: Built on Oxide engine (Rust-based), significant
  speedup
- **`@source` directive**: Tells Tailwind where to scan for classes -- critical
  for monorepo setups where components live in `packages/ui`

### Monorepo Setup Pattern

shadcn/ui has official monorepo support since v4. The CLI understands Turborepo
workspace structure.

**Step 1: Initialize shadcn/ui in packages/ui**

```bash
cd packages/ui
pnpm dlx shadcn@latest init --monorepo
```

This creates:
- `packages/ui/src/components/ui/` -- component directory
- `packages/ui/src/lib/utils.ts` -- `cn()` helper (clsx + tailwind-merge)
- `packages/ui/src/styles/globals.css` -- Tailwind v4 theme with CSS variables

**Step 2: Configure Tailwind source scanning**

In `packages/ui/src/styles/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

/* Tell Tailwind to scan monorepo paths */
@source "../../src/**/*.{ts,tsx}";
@source "../../../apps/web/src/**/*.{ts,tsx}";

@theme {
  /* Design tokens as CSS custom properties */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0.064 280.749);
  /* ... shadcn/ui generates the full token set */
}
```

**Step 3: Configure PostCSS in apps/web**

```javascript
// apps/web/postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**Step 4: Import globals.css in Next.js layout**

```typescript
// apps/web/src/app/layout.tsx
import '@customreport/ui/styles/globals.css';
```

### Adding Components

```bash
# From packages/ui directory:
pnpm dlx shadcn@latest add button card table dialog form input
pnpm dlx shadcn@latest add select textarea badge separator
pnpm dlx shadcn@latest add tabs sheet dropdown-menu tooltip
pnpm dlx shadcn@latest add alert progress skeleton avatar
```

The CLI places components in `packages/ui/src/components/ui/` and handles
dependency resolution within the monorepo.

### PDF Report Styling

Playwright PDF generation renders HTML to PDF. Tailwind classes work in PDF
rendering because Playwright runs a full Chromium browser. The PDF report
template should:

- Use `@media print` Tailwind modifiers for print-specific styles
- Set explicit page sizes via `@page { size: A4; margin: 2cm; }`
- Avoid `oklch()` colors if targeting older PDF viewers -- convert to `hsl()`
  fallbacks in the print stylesheet

### What NOT to Add

| Package | Why Not |
|---------|---------|
| `tailwindcss-animate` | Deprecated. Use `tw-animate-css` (CSS-only, Tailwind v4 native) |
| `tailwind.config.js` | Tailwind v4 uses CSS-first config via `@theme`. JS config is legacy |
| `@radix-ui/*` directly | shadcn/ui wraps Radix primitives. Install via `shadcn add`, not manually |
| `@headlessui/react` | Conflicts with Radix primitives used by shadcn/ui |
| `Ant Design` / `MUI` | Project decision is shadcn/ui. These are heavyweight alternatives |
| `styled-components` | Tailwind CSS replaces CSS-in-JS entirely |
| `autoprefixer` | Tailwind v4 handles prefixing internally (no longer a separate PostCSS plugin) |

**Confidence:** HIGH -- shadcn/ui monorepo support is official (v4), Tailwind
v4.2.2 is current stable, all versions verified against npm registry.

---

## 2. Playwright E2E Tests

### Current State

- `@playwright/test@^1.55.0` is in `apps/web/devDependencies` (installed)
- `playwright@^1.59.1` is in `apps/api/dependencies` (for PDF generation)
- No Playwright config file, no E2E test files, no test fixtures

### Recommended Stack

| Package | Version | Install Location | Purpose |
|---------|---------|-----------------|---------|
| `@playwright/test` | `^1.59.1` | `apps/web` (devDep) | E2E test framework (update from ^1.55.0) |
| `playwright` | `^1.59.1` | `apps/api` (dep) | Already installed for PDF. Keep in sync |

**Version alignment is critical**: `@playwright/test` and `playwright` core
must be the same major.minor version. Currently web has ^1.55.0 and api has
^1.59.1. Update web to ^1.59.1.

### Project Structure

```
apps/web/
  e2e/
    playwright.config.ts       # Playwright config
    fixtures/
      auth.fixture.ts          # SAML auth bypass for tests
      report.fixture.ts        # Pre-seeded report data
    tests/
      lead-workflow.spec.ts    # Lead: login -> fill -> submit
      head-workflow.spec.ts    # Head: review -> publish -> PDF
      admin-workflow.spec.ts   # Admin: manage users/projects
    helpers/
      api.ts                   # Direct API calls for setup/teardown
```

### Configuration

```typescript
// apps/web/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,  // Sequential -- tests share report state
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Single worker -- tests modify shared DB state
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter=@customreport/api dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter=@customreport/web dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

### Auth Bypass for E2E

The existing `AUTH_DEV_MODE=true` pattern bypasses SAML. E2E tests use this
to authenticate without a running Keycloak instance. The auth fixture sets
the JWT cookie directly:

```typescript
// apps/web/e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{ leadPage: Page; headPage: Page }>({
  leadPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    // Set auth cookie with lead role (dev mode JWT)
    await context.addCookies([{
      name: 'session',
      value: generateDevJwt({ role: 'lead', userId: 'lead-1' }),
      domain: 'localhost',
      path: '/',
    }]);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  headPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'session',
      value: generateDevJwt({ role: 'head', userId: 'head-1' }),
      domain: 'localhost',
      path: '/',
    }]);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
```

### Key Design Decisions

- **Single worker, sequential**: Tests share database state (lead submits
  section -> head reviews -> publish -> PDF). Parallelism would require
  complex isolation
- **Chromium only**: PDF generation uses Chromium. Testing other browsers
  adds no value for an internal tool with 6 users
- **`webServer` dual config**: Playwright starts both Next.js and NestJS
  before tests run
- **`trace: 'retain-on-failure'`**: Playwright 1.59 feature -- records traces
  for all attempts but only keeps them when a test fails

### What NOT to Add

| Package | Why Not |
|---------|---------|
| `@playwright/test/experimental-ct-react` | Component testing is Vitest's domain. Playwright is for E2E only |
| `playwright-bdd` | Cucumber/Gherkin syntax adds overhead with no value for 6-user internal tool |
| `msw` for E2E | MSW is for unit/integration tests. E2E tests hit real API |
| `testcontainers` | DB setup via Prisma seed scripts is simpler for E2E |
| Multiple browser projects | Internal tool, Chromium-only is sufficient |

**Confidence:** HIGH -- Playwright 1.59.1 is current stable, E2E config
pattern is well-documented by Next.js and Playwright.

---

## 3. Next.js 15 -> 16 Migration

### Current State

| Property | Current | Target |
|----------|---------|--------|
| `next` | `^15.5.0` | `^16.2.3` |
| `react` | `^19.1.0` | `^19.2.5` |
| `react-dom` | `^19.1.0` | `^19.2.5` |
| Node.js minimum | `>=20.0.0` | `>=20.9.0` (Next.js 16 requirement) |

### Breaking Changes That Affect This Codebase

**1. middleware.ts -> proxy.ts rename**

Next.js 16 renames `middleware.ts` to `proxy.ts`. The codebase does not
currently have a middleware.ts file, so this is a no-op. But if middleware
is added in v3.0, it must be named `proxy.ts`.

Configuration flags also renamed:
- `skipMiddlewareUrlNormalize` -> `skipProxyUrlNormalize`

**2. Turbopack is now the default bundler**

Turbopack replaces Webpack for both dev and production builds. The existing
`next.config.ts` does not reference Webpack, so no config changes needed.

**3. Cache Components (`'use cache'` directive)**

Next.js 16 introduces `'use cache'` for explicit caching. This replaces
the old `force-cache` / `revalidate` patterns. The codebase currently has
no caching directives, so this is opt-in for v3.0. Consider adding `'use
cache'` to report list pages and published report views.

**4. React 19.2 features**

- **View Transitions**: `document.startViewTransition()` for page navigation
  animations. Useful for report form -> preview transitions
- **React Compiler (1.0 stable)**: Auto-memoization. Enable via
  `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  reactCompiler: true,  // NEW in Next.js 16
};
```

**5. `next.config.ts` changes**

No breaking config changes in this codebase. `output: 'standalone'` remains
supported. `reactStrictMode: true` remains supported.

### Migration Steps

```bash
# 1. Run the official codemod
cd apps/web
npx @next/codemod@latest upgrade

# The codemod handles:
# - middleware.ts -> proxy.ts rename (if exists)
# - skipMiddlewareUrlNormalize -> skipProxyUrlNormalize (if used)
# - async request API updates (params, searchParams)
# - Dynamic import named export transforms

# 2. Update dependencies
pnpm --filter=@customreport/web add next@^16.2.3 react@^19.2.5 react-dom@^19.2.5

# 3. Update root type packages
pnpm add -D @types/react@latest @types/react-dom@latest

# 4. Test build
pnpm --filter=@customreport/web build
```

### What Changes in next.config.ts

```typescript
// apps/web/next.config.ts -- AFTER migration
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  reactCompiler: true,  // Enable React Compiler auto-memoization
};

export default nextConfig;
```

### What NOT to Change

- Do NOT add `'use cache'` everywhere -- opt-in only for read-heavy pages
- Do NOT switch to `proxy.ts` unless adding middleware. The file does not
  exist yet
- Do NOT disable Turbopack -- it is now the default and faster than Webpack
- Do NOT add `experimental` flags for features that are now stable (e.g.,
  `serverActions` is stable in v16)

**Confidence:** HIGH -- Next.js 16.2.3 is current stable (npm verified),
codemod is official, breaking changes documented.

---

## 4. Vitest 3 -> 4 Migration

### Current State

| Property | Current | Target |
|----------|---------|--------|
| `vitest` | `^3.2.4` | `^4.1.4` |
| Vite dependency | implicit (via vitest) | Vite >= 6.0.0 (peer dep) |
| Node.js | >=20.0.0 | >=20.0.0 (unchanged) |

### Breaking Changes That Affect This Codebase

**1. `workspace` -> `projects` rename**

The codebase does not use Vitest workspaces, so this is a no-op.

**2. Coverage configuration changes**

`coverage.all` and `coverage.extensions` removed. Must define
`coverage.include` explicitly. The codebase does not currently configure
coverage, so this only matters when adding coverage later.

**3. Pool option changes**

`maxThreads`/`maxForks` -> `maxWorkers`. The codebase does not configure
pool options, so default behavior applies.

**4. Mocking behavior changes**

- `vi.fn().getMockName()` returns `"vi.fn()"` instead of `"spy"` -- check
  if any test asserts on mock names
- `vi.restoreAllMocks()` only affects `vi.spyOn` calls -- verify test
  cleanup patterns
- Mock invocation order starts at 1 (was 0) -- check if any test asserts
  on `invocationCallOrder`

**5. Default exclusions narrowed**

Only `node_modules` and `.git` are excluded by default. Previously excluded
patterns like `dist`, `.cache`, `*.config.js` are no longer excluded. The
existing vitest config explicitly sets `exclude: ['e2e/**', 'node_modules/**']`,
which overrides defaults anyway.

### Migration Steps

```bash
# 1. Update vitest in root package.json
pnpm add -D vitest@^4.1.4

# 2. No vitest.config.ts changes needed for this codebase
# The existing config uses standard options that are unchanged

# 3. Run tests to verify
pnpm test

# 4. Fix any mock behavior assertions if tests fail
```

### vitest.config.ts -- No Changes Needed

The existing config is compatible with Vitest 4:

```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',        // unchanged
    setupFiles: ['./vitest.setup.ts'],  // unchanged
    globals: false,              // unchanged
    exclude: ['e2e/**', 'node_modules/**'],  // unchanged, overrides narrower defaults
  },
  // ...
});
```

### What NOT to Change

- Do NOT add `vite` as explicit dependency -- Vitest 4 bundles its own Vite
  or uses the project's Vite if present. Next.js uses Turbopack, not Vite,
  so Vitest manages its own Vite internally
- Do NOT switch to browser mode for unit tests -- keep jsdom for component
  tests. Browser mode is for visual regression testing
- Do NOT add `@vitest/coverage-v8` yet -- add when coverage gate is needed
  in CI

**Confidence:** HIGH -- Vitest 4.1.4 is current stable (npm verified),
breaking changes are minor for this codebase.

---

## 5. ESLint 9 -> 10 + pnpm 9 -> 10

### 5a. ESLint 10 Migration

#### Current State

No ESLint config files exist in the project. The `lint` scripts run
`tsc --noEmit` (typecheck only). ESLint is not installed as a dependency.

#### Recommended Approach

Since ESLint is not yet configured, this is a fresh setup on v10, not a
migration. Start with flat config directly.

| Package | Version | Install Location | Purpose |
|---------|---------|-----------------|---------|
| `eslint` | `^10.2.0` | root (devDep) | Core linter |
| `@typescript-eslint/eslint-plugin` | `^8.32.0` | root (devDep) | TypeScript rules |
| `@typescript-eslint/parser` | `^8.32.0` | root (devDep) | TypeScript parser |
| `eslint-plugin-react-hooks` | `^5.2.0` | root (devDep) | React hooks rules |
| `eslint-plugin-react-compiler` | `^0.20.0` | root (devDep) | React Compiler lint rules |
| `eslint-config-next` | `^16.2.3` | root (devDep) | Next.js recommended rules |

**Configuration:**

```typescript
// eslint.config.ts (root of monorepo)
import { defineConfig } from 'eslint/config';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';

export default defineConfig([
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-compiler': reactCompiler,
    },
    rules: {
      // TypeScript strict
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
]);
```

**Key ESLint 10 behaviors:**
- Config lookup starts from each linted file's directory (not CWD) --
  ideal for monorepo. A single `eslint.config.ts` at root covers all
  packages
- JSX reference tracking is automatic
- `eslint:recommended` now includes `no-unassigned-vars`,
  `no-useless-assignment`, `preserve-caught-error`
- Requires Node.js ^20.19.0 or ^22.13.0 or >=24

#### What NOT to Add

- `.eslintrc.json` -- ESLint 10 only supports flat config (`eslint.config.*`)
- `eslint-plugin-import` -- heavy plugin, not needed initially. Add only if
  import ordering becomes a team concern
- `eslint-plugin-sonarjs` -- nice-to-have but not critical for initial setup
- `@eslint/js` recommended config -- start with TypeScript-specific rules

### 5b. pnpm 9 -> 10 Migration

#### Current State

`"packageManager": "pnpm@9.15.0"` in root `package.json`.

#### Breaking Changes

**1. Lifecycle scripts blocked by default**

pnpm 10 does not run lifecycle scripts of dependencies during install unless
explicitly allowed. For this project, `prisma` needs post-install to generate
the client.

Add to `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*

onlyBuiltDependencies:
  - prisma
  - '@prisma/client'
  - playwright
  - esbuild
```

Note: `onlyBuiltDependencies` is the pnpm 10 setting (renamed from v9's
deprecated `allowedDeprecatedVersions`). For pnpm 11+, migrate to
`allowBuilds` map format.

**2. Nothing is hoisted by default**

Packages containing `eslint` or `prettier` in their name are no longer
auto-hoisted. Since our ESLint config is at root and uses flat config with
direct imports, this should not matter. If tool resolution breaks, add
explicit hoist patterns to `pnpm-workspace.yaml`:

```yaml
nodeLinker: hoisted  # or add specific hoist patterns
```

**3. `npm_config_*` env vars no longer read**

pnpm 10 only reads `pnpm_config_*` environment variables. Check CI
scripts for any `npm_config_*` usage and rename to `pnpm_config_*`.

**4. Node.js requirement**

pnpm 10.0.0 requires Node.js >= 18.12. The project already targets
Node.js >= 20.0.0, so this is satisfied.

#### Migration Steps

```bash
# 1. Update packageManager field in root package.json
# Change "packageManager": "pnpm@9.15.0" to:
# "packageManager": "pnpm@10.33.0"

# 2. Update pnpm via corepack
corepack prepare pnpm@10.33.0 --activate

# 3. Add onlyBuiltDependencies to pnpm-workspace.yaml
# (see above)

# 4. Delete node_modules and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# 5. Verify all scripts work
pnpm build
pnpm test
```

#### Node.js Engine Bump

**Critical**: ESLint 10 requires Node.js ^20.19.0 or ^22.13.0 or >=24.
The current `"engines": { "node": ">=20.0.0" }` should be tightened:

```json
{
  "engines": {
    "node": ">=20.19.0"
  }
}
```

This satisfies all tools:
- pnpm 10: >= 18.12 (satisfied)
- ESLint 10: ^20.19.0 (satisfied)
- Vitest 4: >= 20.0.0 (satisfied)
- Next.js 16: >= 20.9.0 (satisfied)

**Confidence:** HIGH for pnpm migration (simple, npm-verified). MEDIUM-HIGH
for ESLint (fresh setup, not migration, but config syntax may need iteration).

---

## 6. pgvector RAG Analytics

### Current State

- PostgreSQL 15+ is in the stack (Docker Compose)
- No vector extensions, no embedding code, no analytics features

### Recommended Stack

| Package | Version | Install Location | Purpose |
|---------|---------|-----------------|---------|
| `pgvector` | `^0.2.1` | `apps/api` (dep) | pgvector Node.js client (vector type helpers) |
| `openai` | `^6.34.0` | `apps/api` (dep) | OpenAI API client for embeddings |

### Architecture Decision: Prisma + Raw SQL for pgvector

Prisma does not natively support the `vector` type. The recommended approach
(from Prisma docs) is:

1. **Schema**: Use `Unsupported("vector")` for the embedding column
2. **Migration**: Customize the migration SQL to add the vector column and
   HNSW index
3. **Queries**: Use `prisma.$queryRaw` / `prisma.$executeRaw` for vector
   operations (insert, similarity search)

```prisma
// prisma/schema.prisma (addition)
model ReportEmbedding {
  id            String   @id @default(cuid())
  reportId      String
  sectionId     String?
  chunkText     String
  embedding     Unsupported("vector(1536)")
  createdAt     DateTime @default(now())

  report        Report   @relation(fields: [reportId], references: [id])

  @@index([reportId])
}
```

Custom migration SQL (after `prisma migrate dev --create-only`):

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add HNSW index for fast similarity search
CREATE INDEX report_embedding_hnsw_idx
  ON "ReportEmbedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Embedding Strategy

**Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
- Cost: $0.02 per 1M tokens (~$0.10 to embed 10K reports)
- Quality: Sufficient for semantic search over structured report text

**Chunking**: Each report section's items, risks, and decisions are
concatenated into a text chunk per section. One embedding per section
(not per item) to keep vector count manageable.

**Embedding pipeline** (BullMQ job):

```
Report published
  -> BullMQ 'embed-report' job
  -> Fetch all sections from Prisma
  -> For each section: concatenate text -> call OpenAI embedding API
  -> Store embedding via $executeRaw
```

### Similarity Search Query

```typescript
// apps/api/src/modules/analytics/analytics.repository.ts
async findSimilarSections(queryEmbedding: number[], limit: number = 5) {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  return this.prisma.$queryRaw`
    SELECT
      re.id,
      re."reportId",
      re."sectionId",
      re."chunkText",
      re.embedding <=> ${vectorStr}::vector AS distance
    FROM "ReportEmbedding" re
    ORDER BY re.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
}
```

### Docker Compose Addition

```yaml
# Update postgres service in docker-compose.yml
postgres:
  image: pgvector/pgvector:pg15
  # ... existing config
```

The `pgvector/pgvector:pg15` image is PostgreSQL 15 with pgvector extension
pre-installed. Replace `postgres:15-alpine` with this image.

### What NOT to Add

| Package / Tool | Why Not |
|----------------|---------|
| Pinecone / Weaviate / Qdrant | Dedicated vector DB is overkill. pgvector keeps everything in PostgreSQL -- simpler ops, simpler backups, transactional consistency with report data |
| `langchain` | Heavy framework (190+ packages). Direct OpenAI SDK + raw SQL is simpler and more maintainable for this use case |
| `prisma-extension-pgvector` (0.11.0) | Low-maintenance community package. Raw SQL with Prisma is more reliable and documented by Prisma themselves |
| `@prisma-next/extension-pgvector` | Prisma Next extension -- not yet production-ready |
| Full-text search (FTS) with `tsvector` | pgvector semantic search is more powerful for the "chatbot over reports" use case. FTS is keyword-based |
| `text-embedding-3-large` (3072 dims) | 3x more expensive, 2x storage. `text-embedding-3-small` (1536 dims) is sufficient for ~50 reports/year |
| LLM for chat (self-hosted) | Use OpenAI's GPT-4o-mini API for the chatbot. Self-hosted LLM adds infrastructure complexity |

### Alternative Embedding Provider

If OpenAI API is not available in the corporate network, alternatives:

| Provider | Model | Dims | Cost | Notes |
|----------|-------|------|------|-------|
| OpenAI | text-embedding-3-small | 1536 | $0.02/1M tokens | Recommended |
| Anthropic | voyage-3-lite | 1024 | $0.02/1M tokens | Anthropic partner |
| Local | nomic-embed-text | 768 | Free (CPU) | Requires Ollama or similar |

The `openai` npm package supports custom base URLs, so swapping to a
compatible API is a configuration change, not a code change.

**Confidence:** MEDIUM-HIGH -- pgvector + Prisma raw SQL pattern is
documented by Prisma. OpenAI embedding API is stable. The main risk is
corporate network access to OpenAI API.

---

## Complete New Dependencies Summary

### packages/ui (production)

```bash
pnpm --filter=@customreport/ui add \
  tailwindcss@^4.2.2 \
  tw-animate-css@^1.4.0 \
  class-variance-authority@^0.7.0 \
  clsx@^2.1.0 \
  tailwind-merge@^3.0.0 \
  lucide-react@^0.500.0
```

### apps/web (production)

```bash
pnpm --filter=@customreport/web add \
  next@^16.2.3 \
  react@^19.2.5 \
  react-dom@^19.2.5

pnpm --filter=@customreport/web add -D \
  @playwright/test@^1.59.1 \
  @tailwindcss/postcss@^4.2.2 \
  postcss@^8.5.0 \
  tailwindcss@^4.2.2
```

### apps/api (production)

```bash
pnpm --filter=@customreport/api add \
  pgvector@^0.2.1 \
  openai@^6.34.0
```

### Root (dev dependencies)

```bash
pnpm add -D \
  vitest@^4.1.4 \
  eslint@^10.2.0 \
  @typescript-eslint/eslint-plugin@^8.32.0 \
  @typescript-eslint/parser@^8.32.0 \
  eslint-plugin-react-hooks@^5.2.0 \
  eslint-plugin-react-compiler@^0.20.0 \
  eslint-config-next@^16.2.3 \
  typescript@^6.0.2 \
  @types/react@latest \
  @types/react-dom@latest
```

### Root config changes

```json
{
  "packageManager": "pnpm@10.33.0",
  "engines": { "node": ">=20.19.0" }
}
```

---

## Version Upgrade Matrix

| Package | Current | Target | Breaking? | Migration Effort |
|---------|---------|--------|-----------|-----------------|
| `next` | 15.5.0 | 16.2.3 | Yes | Low (codemod handles it; no middleware.ts to rename) |
| `react` | 19.1.0 | 19.2.5 | No | Drop-in (minor version bump) |
| `react-dom` | 19.1.0 | 19.2.5 | No | Drop-in |
| `vitest` | 3.2.4 | 4.1.4 | Yes | Low (no pool/workspace config to migrate) |
| `eslint` | N/A | 10.2.0 | N/A | Fresh setup (no existing config) |
| `pnpm` | 9.15.0 | 10.33.0 | Yes | Medium (lifecycle scripts, hoist changes) |
| `typescript` | 5.8.3 | 6.0.2 | Minor | Low (strict-by-default matches existing config) |
| `@playwright/test` | 1.55.0 | 1.59.1 | No | Drop-in (minor version bump) |
| `tailwindcss` | N/A | 4.2.2 | N/A | Fresh setup |
| `pgvector` | N/A | 0.2.1 | N/A | Fresh setup |

---

## Upgrade Order (Dependency Chain)

Execute upgrades in this order to avoid breakage:

```
1. pnpm 9 -> 10          (tooling foundation -- must come first)
   |
2. TypeScript 5.8 -> 6.0  (language -- affects all packages)
   |
3. React 19.1 -> 19.2     (library -- no breaking changes)
   |
4. Next.js 15 -> 16       (framework -- depends on React 19.2)
   |
5. Vitest 3 -> 4          (testing -- independent of above)
   |
6. ESLint 10 setup        (quality -- independent, fresh config)
   |
7. Tailwind v4 + shadcn/ui (styling -- independent, new setup)
   |
8. pgvector + OpenAI       (analytics -- independent, new setup)
```

Steps 5-8 are independent and can run in parallel. Steps 1-4 are sequential
due to dependency chain.

---

## What NOT to Add (Global Anti-Recommendations)

| Package / Tool | Why Not |
|----------------|---------|
| `prettier` as separate tool | Tailwind v4 has built-in class sorting via `@tailwindcss/prettier` if needed later. Start without it |
| `husky` + `lint-staged` | Add in the CI/CD phase, not during styling/testing setup |
| `@sentry/nextjs` | Structured logging covers v3.0. Sentry for v4.0+ |
| `next-intl` / `react-i18next` | Single-language app (Russian). i18n adds complexity with no value |
| `next-themes` | Dark mode is nice-to-have, not table stakes for internal reporting tool |
| `zustand` / `jotai` | tRPC + React Query handle server state. No complex client state needed |
| `react-hook-form` | shadcn/ui forms work with native React 19 form actions. External form lib is unnecessary |
| `@tanstack/react-table` | 6 leads, <20 projects. Plain HTML tables with shadcn/ui Table component are sufficient |
| `drizzle-orm` | Do not add a second ORM for pgvector queries. Prisma raw SQL is sufficient |
| `docker-compose` profiles | Keep simple. One compose file for dev, one for prod |
| `nginx` reverse proxy | Not needed for Docker Compose port exposure |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| shadcn/ui + Tailwind v4 monorepo | **HIGH** | Official monorepo support, all versions npm-verified |
| Playwright E2E | **HIGH** | Already partially installed, well-documented pattern |
| Next.js 15 -> 16 | **HIGH** | Official codemod, minimal breaking changes for this codebase |
| Vitest 3 -> 4 | **HIGH** | Minor breaking changes, existing config is compatible |
| ESLint 10 | **MEDIUM-HIGH** | Fresh setup (not migration), flat config may need iteration |
| pnpm 9 -> 10 | **HIGH** | Lifecycle script change is the main concern, well-documented |
| TypeScript 5 -> 6 | **HIGH** | Strict-by-default matches existing config. No breaking changes expected |
| pgvector + Prisma | **MEDIUM-HIGH** | Documented pattern, but Prisma native support is not yet available. Raw SQL works reliably |
| OpenAI embeddings | **MEDIUM** | API is stable, but corporate network access is an external risk |

---

## Sources

### Official Documentation
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- last updated April 8, 2026
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Next.js Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods)
- [ESLint 10 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- [ESLint 10 Release Blog](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)
- [Vitest 4 Migration Guide](https://vitest.dev/guide/migration.html)
- [Vitest 4 Blog Post](https://vitest.dev/blog/vitest-4)
- [pnpm 10 Discussion](https://github.com/orgs/pnpm/discussions/8945)
- [shadcn/ui Monorepo](https://ui.shadcn.com/docs/monorepo)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [Prisma + pgvector Extensions](https://www.prisma.io/docs/postgres/database/postgres-extensions)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes)
- [Playwright Next.js Testing](https://nextjs.org/docs/pages/guides/testing/playwright)

### Community / Analysis
- [pgvector Guide: RAG in PostgreSQL](https://encore.dev/blog/you-probably-dont-need-a-vector-database) -- why pgvector over dedicated vector DBs
- [PostgreSQL Vector Search 2026](https://calmops.com/database/postgresql-vector-search-pgvector-2026/)
- [tw-animate-css](https://github.com/Wombosvideo/tw-animate-css) -- Tailwind v4 animation replacement
- [Next.js 16 Migration Guide (community)](https://www.salmanizhar.com/blog/nextjs-16-migration-guide)
- [Turborepo + shadcn/ui + Tailwind v4 template](https://github.com/linkb15/turborepo-shadcn-ui-tailwind-4)
- [OpenAI Embeddings Pricing (April 2026)](https://costgoat.com/pricing/openai-embeddings)
- [pgvector-node GitHub](https://github.com/pgvector/pgvector-node)

### npm Registry (verified April 11, 2026)
- next@16.2.3, react@19.2.5, vitest@4.1.4, eslint@10.2.0
- pnpm@10.33.0, tailwindcss@4.2.2, @playwright/test@1.59.1
- pgvector@0.2.1, openai@6.34.0, tw-animate-css@1.4.0
- typescript@6.0.2, @tailwindcss/postcss@4.2.2

---

*Last updated: 2026-04-11 (v3.0 UI Polish & Analytics research)*
