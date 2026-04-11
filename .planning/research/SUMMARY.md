# Project Research Summary

**Project:** CustomReport v3.0 -- UI Polish & Analytics
**Domain:** Internal weekly status report web application (Next.js + NestJS + Prisma monorepo)
**Researched:** 2026-04-11
**Confidence:** HIGH

## Executive Summary

CustomReport is a functionally complete but visually unpresentable internal tool used by 6 team leads and 1 department head to produce weekly status reports. The v1.0 and v2.0 milestones shipped full domain logic (8 services, 51 unit tests) and infrastructure (Prisma 7, NestJS 11, Docker Compose, SAML auth, BullMQ, tRPC). However, the entire frontend renders raw HTML with zero CSS -- browser-default forms, selects, and buttons. The `packages/ui` workspace is an empty shell. The 7 E2E test skeletons use localStorage injection against a data layer that no longer exists. The v3.0 milestone must fix this: styling is the number one priority, because the PDF report delivered to the director IS the product.

The recommended approach is a strict sequential pipeline: (1) tooling upgrades (pnpm 10, TypeScript 6, Next.js 16, Vitest 4, ESLint 10), (2) shadcn/ui + Tailwind v4 design system setup and component-by-component restyling of all 22 components, (3) PDF print page styling, (4) Playwright E2E tests against the real Docker Compose stack, and (5) pgvector RAG analytics as a feature-flagged addition. All four research files converge on this ordering: the pitfalls research explicitly warns against writing E2E tests before styling (selectors break during shadcn migration), and the architecture research confirms analytics is the most isolated feature that can ship last. The tooling upgrades must come first because Next.js 16 changes fundamental file conventions (middleware to proxy rename) and API patterns (mandatory async params) that would force rework if done after component migration.

The key risks are: (a) Tailwind v4 classes invisible in the consuming app if `@source` directives and `transpilePackages` are misconfigured -- this is the single most likely day-one blocker; (b) Prisma 7.0-7.1 migration drift bug with pgvector `Unsupported("vector")` columns -- mitigated by requiring Prisma 7.2.0+; and (c) Playwright E2E auth desync when JWT tokens expire during long test runs -- mitigated by per-worker auth fixtures with extended token lifetimes. Corporate network access to OpenAI API for embeddings is an external risk that cannot be mitigated by code.

## Key Findings

### Recommended Stack

The v3.0 milestone adds six capability areas to the existing validated stack. All versions were verified against the npm registry on April 11, 2026. The core additions are Tailwind CSS v4 (CSS-first config via `@theme` directive, no JS config file), shadcn/ui v4 (monorepo-aware CLI, copy-paste component model), and Playwright 1.59.1 for E2E testing. Major version upgrades: Next.js 15->16 (Turbopack default, middleware->proxy rename, async request APIs mandatory), Vitest 3->4 (minor mock behavior changes), ESLint 10 (fresh setup with flat config), pnpm 9->10 (lifecycle scripts blocked by default). The RAG analytics layer adds pgvector 0.2.1 and OpenAI SDK 6.34.0.

**Core new technologies:**
- **Tailwind CSS 4.2.2 + shadcn/ui v4**: Design system and component library -- CSS-first config, monorepo-aware, copy-paste components with zero runtime dependency
- **Next.js 16.2.3**: Framework upgrade -- Turbopack default, React Compiler 1.0, `'use cache'` directive for opt-in caching
- **Playwright 1.59.1 (E2E)**: Full user journey testing -- CLI-only execution, auth fixtures via `AUTH_DEV_MODE`, single Chromium worker
- **pgvector 0.2.1 + OpenAI SDK 6.34.0**: Semantic search and RAG chatbot -- pgvector in existing PostgreSQL, no separate vector DB
- **ESLint 10.2.0**: Fresh setup with flat config, TypeScript strict rules, React Compiler lint rules
- **pnpm 10.33.0**: Package manager upgrade -- lifecycle scripts require `onlyBuiltDependencies` allowlist for Prisma and Playwright

**Critical version requirements:**
- Prisma must be 7.2.0+ to avoid migration drift bug with pgvector columns
- Node.js must be >=20.19.0 (intersection of ESLint 10, Next.js 16, pnpm 10 requirements)
- `@playwright/test` and `playwright` core must be the same major.minor (currently mismatched: 1.55.0 vs 1.59.1)
- `tw-animate-css` replaces deprecated `tailwindcss-animate` for Tailwind v4 compatibility

### Expected Features

**Must have (table stakes) -- styling is the top priority:**
- Design system foundation (CSS variables, Tailwind config, design tokens in `packages/ui`)
- shadcn/ui primitives install (~15 components: Button, Input, Select, Card, Badge, Dialog, Table, etc.)
- Lead report form restyling (the primary weekly-use surface for 6 leads)
- Head dashboard + assembled report restyling
- Published report + archive restyling (the outward-facing deliverable)
- Admin panel restyling (Tabs + DataTables for CRUD)
- Navigation shell (sidebar + header + branding)
- PDF report styling (the deliverable artifact the director sees -- requires `@media print` rules, `break-inside: avoid`, `printBackground: true`)
- Responsive layout (mobile/tablet for meeting use)

**Should have (differentiators):**
- Traffic light trend sparklines (project status over 8 weeks -- pure SQL aggregation + shadcn Chart)
- Submission progress tracker (real-time 4/6 leads submitted with countdown)
- Project health dashboard (aggregate view: all projects, trends, risks, decisions)
- Semantic search across reports (hybrid: PostgreSQL `tsvector` full-text + pgvector cosine similarity via RRF)
- Dark mode (trivial bolt-on after design tokens are correct)

**Defer to v4+:**
- RAG chatbot (most complex, depends on search infrastructure already working)
- Report comparison diff (useful but not urgent)
- Auto-generated executive summary (LLM-dependent, nice-to-have)
- Email report digest, keyboard shortcuts, CI/CD pipeline (independent standalone work)

### Architecture Approach

The v3.0 changes are layered onto a clean existing architecture. shadcn/ui is purely a presentation layer change -- tRPC data flow is completely untouched. Components still receive data via `trpc.*.useQuery()` and dispatch mutations via `trpc.*.useMutation()`. The design tokens and primitives live in `packages/ui`, consumed by `apps/web` via CSS import chain. E2E tests require a dual `webServer` config (NestJS on port 3101 + Next.js on port 3100) because the existing Playwright config only starts the frontend. The RAG analytics pipeline is the most architecturally invasive addition: it introduces a new BullMQ queue (embedding-generation), a new database model (ReportEmbedding with pgvector column), a new external dependency (OpenAI API), and a new tRPC namespace (analytics with 4 procedures). It is feature-flagged via `ANALYTICS_ENABLED=false` by default.

**Major components being added/modified:**
1. **packages/ui** (NEW content) -- shadcn/ui primitives, design tokens, `cn()` utility. Pure UI, no data fetching.
2. **apps/web** (MODIFIED) -- All 22 components restyled, analytics pages added, E2E tests in `apps/web/e2e/`
3. **apps/api** (MODIFIED) -- AnalyticsModule (service + repository + router), EmbeddingProcessor (BullMQ), EmbeddingClient (OpenAI wrapper), dev-mode role switching in trpc.context.ts
4. **packages/shared** (MODIFIED) -- Analytics Zod schemas (SearchResult, ChatMessage, Trend)

### Critical Pitfalls

1. **Tailwind classes invisible in consuming app (P1)** -- `@source` directive in `globals.css` must point to `../../packages/ui/src/**` AND `transpilePackages: ['@customreport/ui']` must be set in `next.config.ts`. Validate with a single Button component before proceeding with bulk migration.

2. **Next.js 16 middleware.ts silently ignored (P2)** -- File must be renamed to `proxy.ts`, exported function renamed to `proxy`. Authentication bypass in production. The codebase may not have this file yet, but if middleware is added, it MUST use the new name.

3. **Prisma 7 migration drift with pgvector Unsupported type (P3)** -- Use Prisma 7.2.0+, `--create-only` flag, and hand-edit migration SQL to include explicit vector dimensions and `CREATE EXTENSION vector` as the first line.

4. **Playwright auth desync between Web and API (P4)** -- JWT tokens expire in long test runs. Use per-worker auth fixtures with 24h token lifetime in test env. Ensure `AUTH_DEV_MODE=true` is set in BOTH `apps/web` and `apps/api` .env.test files.

5. **tailwindcss-animate incompatible with Tailwind v4 (P11)** -- Use `tw-animate-css` from day one. Without it, all shadcn/ui animations (Dialog, Dropdown, Tooltip) fail silently.

## Implications for Roadmap

Based on combined research, the v3.0 milestone should be structured as 8-10 phases organized into four sequential work streams. Styling dominates the phase count because it is the highest priority and touches every component.

### Phase 1: Tooling Upgrades
**Rationale:** Next.js 16 changes fundamental file conventions and API patterns. Doing this after component work would require rework. pnpm 10 and ESLint 10 have Node.js version requirements that must be resolved first.
**Delivers:** Updated monorepo toolchain -- pnpm 10, TypeScript 6, React 19.2, Next.js 16, Vitest 4, ESLint 10 flat config
**Addresses:** Framework modernization prerequisite for all subsequent work
**Avoids:** P2 (middleware.ts rename), P5 (Turbopack default), P7 (next lint removal), P9 (async request APIs), P14 (Node.js version bump)
**Upgrade order:** pnpm 10 -> TypeScript 6 -> React 19.2 -> Next.js 16 -> Vitest 4 -> ESLint 10 (steps 1-4 sequential, steps 5-6 can parallel)

### Phase 2: Design System Foundation
**Rationale:** Every styled component depends on design tokens and shadcn/ui primitives being installed and wired correctly. This phase resolves the most likely day-one blocker (Tailwind source scanning in monorepo).
**Delivers:** Working `packages/ui` with design tokens, `cn()` utility, ~15 shadcn/ui primitives, Tailwind v4 wiring in `apps/web`, verified with one rendered Button component
**Addresses:** Design system foundation, shadcn/ui primitives install (FEATURES table stakes)
**Avoids:** P1 (Tailwind classes invisible), P6 (components.json misalignment), P11 (tailwindcss-animate incompatible), P13 (pnpm workspace resolution)

### Phase 3: Navigation Shell + Layout
**Rationale:** Every page uses the navigation shell. Doing it first gives visible improvement and establishes the layout pattern for all subsequent component work.
**Delivers:** Sidebar navigation, header with branding, responsive layout skeleton, dark mode toggle (ThemeProvider)
**Addresses:** Navigation shell, responsive layout, dark mode (FEATURES table stakes)

### Phase 4: Lead Report Form Restyling
**Rationale:** The primary user-facing surface (6 leads use this every Friday). Largest component batch: ReportSectionForm + 6 child editors (ProjectStatusGrid, ItemsEditor, RisksEditor, DecisionsEditor, PrioritiesEditor, AutosaveIndicator).
**Delivers:** Fully styled lead report form with traffic light badges, inline editing tables, risk/decision cards
**Addresses:** Lead report form restyling (FEATURES table stakes)

### Phase 5: Head + Published Report + Admin Restyling
**Rationale:** Groups the remaining component restyling into one phase. Head dashboard, assembled report review, published report, archive list, and admin panel are all medium-complexity styling tasks that can be batched.
**Delivers:** All remaining pages styled -- submission dashboard with progress tracker, assembled report with accordions, published report with professional card layout, archive with DataTable, admin with Tabs + Dialog + DataTable
**Addresses:** Head dashboard, admin panel, published report, archive restyling, submission progress tracker (FEATURES table stakes + differentiator)

### Phase 6: PDF Report Styling
**Rationale:** The PDF is the final deliverable artifact. It must match web styling but needs print-specific overrides (`@media print`, page breaks, margin control). Fiddly work that should be isolated.
**Delivers:** PDF report renders professionally via Playwright PDF capture with background colors, traffic light badges, compact layout, A4 page format
**Addresses:** PDF report styling (FEATURES table stakes)
**Avoids:** Validates that `printBackground: true` works with oklch colors, tests in Docker Compose container chain (api -> web -> PDF file)

### Phase 7: Playwright E2E Tests
**Rationale:** Tests must be written AFTER styling is stable to avoid selector breakage during shadcn/ui migration. Pitfall research explicitly recommends this order.
**Delivers:** Full E2E test suite covering lead fill -> head review -> publish -> PDF export -> archive, using dual webServer config (NestJS + Next.js), per-role auth fixtures via `AUTH_DEV_MODE`, `data-testid` attributes on all interactive elements. Playwright executed via CLI only (not MCP).
**Addresses:** E2E testing (FEATURES priority 2)
**Avoids:** P4 (auth desync), P10 (fragile selectors)
**Note:** Requires `docker-compose.test.yml` for postgres + redis, trpc.context.ts modification for dev-mode role switching via `X-Dev-Role` header

### Phase 8: SQL Analytics (Trends + Dashboard)
**Rationale:** Pure SQL analytics over existing data -- no external APIs, no new infrastructure. High visual impact using shadcn Chart (recharts). Should ship before RAG because it proves the analytics UI patterns.
**Delivers:** Traffic light trend sparklines, project health dashboard, submission progress tracker enhancements
**Addresses:** Traffic light trends, project health dashboard (FEATURES differentiators)

### Phase 9: pgvector + Semantic Search
**Rationale:** Most isolated feature with its own database migration, Docker image change, and raw SQL layer. Feature-flagged via `ANALYTICS_ENABLED`. Depends on Phase 8 analytics UI patterns.
**Delivers:** pgvector extension enabled, ReportEmbedding model, BullMQ embedding pipeline, hybrid search (PostgreSQL `tsvector` full-text + pgvector cosine similarity via Reciprocal Rank Fusion), search UI
**Addresses:** Semantic search across reports (FEATURES differentiator)
**Avoids:** P3 (Prisma migration drift), P8 (HNSW index mismatch), P12 (pgvector Docker image), P15 (raw SQL type safety gap)
**Note:** Docker image must change from `postgres:15-alpine` to `pgvector/pgvector:pg15`. All vector operations use `$queryRaw` behind a typed `VectorRepository` interface.

### Phase Ordering Rationale

- **Tooling before styling**: Next.js 16 changes async params behavior and file conventions. Styling work done on Next.js 15 would need rework after the upgrade.
- **Design system before components**: The `@source` directive and Tailwind wiring must be validated before any component migration begins. One configuration mistake makes all 22 components unstyled.
- **Styling before E2E**: PITFALLS.md explicitly warns that shadcn/ui changes DOM structure (e.g., `<select>` becomes Radix `<Select>` with different ARIA roles). Writing E2E tests first means rewriting selectors after styling.
- **SQL analytics before RAG**: Traffic light trends use pure SQL over existing data. This validates the analytics UI pattern before adding the complexity of external API calls and vector operations.
- **RAG last**: Most complex, most isolated, feature-flagged. Can ship disabled. Does not affect any other feature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Tooling Upgrades):** pnpm 10 lifecycle script blocking may surface unexpected dependencies. Next.js 16 codemod output should be reviewed manually.
- **Phase 6 (PDF Styling):** oklch color space rendering in Playwright PDF capture is not well-documented. May need hsl() fallbacks for print stylesheet.
- **Phase 9 (pgvector + Semantic Search):** Prisma raw SQL for vector operations, hybrid search query combining tsvector + cosine similarity, embedding chunking strategy for Russian-language report text.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Design System Foundation):** shadcn/ui monorepo setup is officially documented with exact steps.
- **Phase 3-5 (Component Restyling):** Component-by-component migration is mechanical work with well-documented shadcn/ui primitives.
- **Phase 7 (Playwright E2E):** Playwright auth patterns and dual webServer config are standard and well-documented.
- **Phase 8 (SQL Analytics):** Pure SQL aggregation + shadcn Chart (recharts) -- standard pattern, no external dependencies.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All versions npm-verified April 11, 2026. Official upgrade guides exist for every major version bump. |
| Features | **HIGH** | Feature set is well-scoped based on existing codebase inventory (22 components, 7 E2E skeletons, 14 Prisma models). Anti-features are clearly justified. |
| Architecture | **HIGH** | Existing v2.0 architecture is clean and well-documented. shadcn/ui is purely presentational (no data flow changes). E2E and RAG integrate at defined extension points. |
| Pitfalls | **HIGH** | 16 pitfalls identified with prevention strategies. Critical ones (P1-P5) are confirmed by official docs or known bug reports. |

**Overall confidence:** HIGH

### Gaps to Address

- **OpenAI API corporate network access**: External risk. If the corporate network blocks OpenAI, the RAG features (Phase 9) require an alternative embedding provider (Voyage 3 Lite, local Nomic via Ollama). The OpenAI SDK supports custom base URLs, so swapping is a config change.
- **PostgreSQL full-text search language config**: `tsvector` needs language-specific dictionaries. Russian text requires `to_tsvector('russian', text)` -- verify the PostgreSQL Docker image includes the Russian dictionary (`pg_catalog.russian`).
- **oklch() color rendering in PDF**: Tailwind v4 uses OKLCH color space. Playwright PDF capture renders via Chromium which supports OKLCH, but older PDF viewers may not display these colors correctly. May need hsl() fallbacks in the print stylesheet.
- **Prisma native pgvector support timeline**: Prisma has announced first-class pgvector support as "coming soon" but it has not shipped. The raw SQL approach works reliably but loses Prisma type safety. Monitor Prisma releases.
- **Dark mode scope decision**: Listed as table stakes in FEATURES but marked as "Low" complexity and recommended as last styling bolt-on. Consider whether to include in v3.0 scope or defer.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Monorepo Documentation](https://ui.shadcn.com/docs/monorepo)
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Playwright Authentication Docs](https://playwright.dev/docs/auth)
- [Prisma PostgreSQL Extensions](https://www.prisma.io/docs/postgres/database/postgres-extensions)
- [Vitest 4 Migration Guide](https://vitest.dev/guide/migration.html)
- [ESLint 10 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- [pnpm 10 Breaking Changes](https://github.com/orgs/pnpm/discussions/8945)
- [Turborepo shadcn/ui Guide](https://turborepo.dev/docs/guides/tools/shadcn-ui)

### Secondary (MEDIUM confidence)
- [pgvector RAG in PostgreSQL](https://encore.dev/blog/you-probably-dont-need-a-vector-database) -- why pgvector over dedicated vector DBs at this scale
- [PostgreSQL Vector Search 2026](https://calmops.com/database/postgresql/postgresql-vector-search-pgvector-complete-guide-2026/) -- HNSW indexing, cosine distance operators
- [Prisma pgvector drift bug #28867](https://github.com/prisma/prisma/issues/28867) -- confirmed fixed in 7.2.0
- [Next.js 16 Migration Walkthrough (community)](https://www.salmanizhar.com/blog/nextjs-16-migration-guide)
- [OpenAI Embeddings Pricing](https://costgoat.com/pricing/openai-embeddings) -- $0.02/1M tokens for text-embedding-3-small
- [Playwright E2E with POM](https://earezki.com/ai-news/2026-03-15-end-to-end-testing-with-playwright-complete-guide-with-page-object-model/)

### npm Registry (verified April 11, 2026)
- next@16.2.3, react@19.2.5, vitest@4.1.4, eslint@10.2.0
- pnpm@10.33.0, tailwindcss@4.2.2, @playwright/test@1.59.1
- pgvector@0.2.1, openai@6.34.0, tw-animate-css@1.4.0
- typescript@6.0.2, @tailwindcss/postcss@4.2.2

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
