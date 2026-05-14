# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```
customreport/
├── apps/
│   ├── api/                    # NestJS backend (tRPC API + auth + jobs)
│   │   └── src/
│   │       ├── infrastructure/ # Cross-cutting: tRPC, Prisma, BullMQ, health, email, config
│   │       ├── modules/        # Domain modules (service + repository + NestJS module)
│   │       ├── lib/            # Shared utilities (logger)
│   │       ├── test-utils/     # Test helpers (Prisma test helper)
│   │       ├── app.module.ts   # Root NestJS module
│   │       └── main.ts         # Application entry point
│   └── web/                    # Next.js 16 frontend
│       ├── e2e/                # Playwright E2E tests (currently deleted/paused)
│       ├── public/             # Static assets
│       └── src/
│           ├── app/            # Next.js App Router pages
│           ├── components/     # React components by domain
│           ├── lib/            # Client utilities (tRPC client, date formatting)
│           ├── server/         # Server-side helpers (auth session)
│           ├── styles/         # Tailwind CSS entry point + safelist
│           └── test/           # Test fixtures and MSW handlers
├── packages/
│   ├── shared/                 # @customreport/shared - Zod schemas + TypeScript types
│   │   └── src/
│   │       ├── schemas/        # auth.ts, report.ts
│   │       ├── trpc/           # Contract testing router (NOT runtime)
│   │       └── index.ts        # Barrel export
│   └── ui/                     # @customreport/ui - shadcn/ui component library
│       └── src/
│           ├── components/     # UI primitives + composition components
│           ├── hooks/          # use-mobile.ts
│           ├── lib/            # cn() utility
│           └── index.ts        # Barrel export
├── prisma/
│   └── schema.prisma           # Database schema (at monorepo root, NOT in apps/api)
├── design-system/              # Design system reference files
├── docs/                       # Project documentation
│   └── api/                    # API documentation
├── mockups/                    # UI/UX mockup HTML files
├── docker-compose.yml          # Development Docker Compose
├── docker-compose.dev.yml      # Dev overrides
├── docker-compose.prod.yml     # Production Docker Compose
├── Dockerfile.api              # API container build
├── Dockerfile.web              # Web container build
├── turbo.json                  # Turborepo task config
├── pnpm-workspace.yaml         # pnpm workspace definition
├── package.json                # Root package.json
└── .planning/                  # GSD workflow planning artifacts
```

## Directory Purposes

**`apps/api/src/infrastructure/`:**

- Purpose: Cross-cutting infrastructure concerns shared across domain modules
- Contains:
  - `trpc/` - tRPC router, middleware, context factory, error mapper (4 source files)
  - `prisma/` - PrismaService (global singleton extending PrismaClient, uses pg.Pool + PrismaPg adapter)
  - `bullmq/` - BullMQ module (Redis connection + queue registration), PDF export processor, email reminder processor, Bull Board UI
  - `health/` - Health check endpoints (Prisma, Redis, BullMQ, memory) via @nestjs/terminus
  - `metrics/` - Prometheus metrics endpoint via prom-client
  - `email/` - SMTP email service via nodemailer (dev mode uses jsonTransport)
  - `config/` - Zod-validated environment schema
  - `middleware/` - Correlation ID middleware (x-request-id)

**`apps/api/src/modules/`:**

- Purpose: Domain modules encapsulating business logic per capability
- Contains: 10 domain modules, each with consistent internal structure
- Key files per module:
  - `{name}.service.ts` - Domain error class + repository interface + service class
  - `{name}.prisma-repository.ts` - Prisma implementation of repository interface
  - `{name}.module.ts` - NestJS module wiring (useFactory pattern)
  - `{name}.router.ts` - Per-module router (vestigial -- NOT used by central router)
  - `{name}.service.test.ts` - Unit tests for service logic
  - `{name}.contract.test.ts` - Contract tests against Zod schemas
  - `{name}.integration.test.ts` - Integration tests with Prisma

**`apps/api/src/modules/auth/`:**

- Purpose: Authentication (SAML SSO, JWT, role guard)
- Key files:
  - `auth.routes.ts` - Express route handlers for SAML login/callback/logout/dev-login + `buildUserSession()` + `ensureWeeklyReport()`
  - `auth.controller.ts` - JWT signer/verifier + session cookie creation
  - `saml.strategy.ts` - Passport SAML strategy configuration
  - `roles.guard.ts` - Simple role guard factory (`createRoleGuard()`)

**`apps/web/src/app/`:**

- Purpose: Next.js App Router page definitions
- Structure:
  - `layout.tsx` - Root layout (HTML shell, fonts, skip-to-content link)
  - `page.tsx` - Login page (SSO button or dev-mode role picker)
  - `auth/error/page.tsx` - Auth error display
  - `(app)/layout.tsx` - Authenticated route group layout (wraps with NavBar)
  - `(app)/lead/report/page.tsx` - Lead report editing
  - `(app)/lead/history/page.tsx` - Lead submission history
  - `(app)/head/dashboard/page.tsx` - Head dashboard (KPIs, lead reports grid)
  - `(app)/head/report/page.tsx` - Assembled weekly report view
  - `(app)/admin/page.tsx` - Admin panel (users, projects, periods, reminders, settings)
  - `(app)/reports/history/page.tsx` - Published report archive
  - `(app)/reports/[reportId]/page.tsx` - Single published report view
  - `(app)/reports/[reportId]/print/page.tsx` - Print-optimized report layout (PDF source)

**`apps/web/src/components/`:**

- Purpose: React components organized by domain
- Subdirectories:
  - `lead/` - Lead form components: `lead-form.tsx`, `sdlc-pipeline.tsx`, `period-navigator.tsx`, `fill-from-button.tsx`, `version-history-nav.tsx`, `current-week-section.tsx`, `next-week-section.tsx`, `risks-section.tsx`, `decisions-section.tsx`, `priorities-section.tsx`, `item-card.tsx`, `stage-chip.tsx`, `lead-history-list.tsx`, `mock-data.ts`
  - `dashboard/` - Head dashboard: `dashboard-page.tsx`, `kpi-cards.tsx`, `alert-bar.tsx`, `blocked-at-risk-table.tsx`, `lead-report-card.tsx`, `lead-reports-grid.tsx`, `report-archive-section.tsx`, `toggle-all-button.tsx`, `mock-data.ts`
  - `weekly-report/` - Assembled report: `weekly-report-page.tsx`, `period-navigator.tsx`, `portfolio-overview-table.tsx`, `product-accordion.tsx`, `publish-lock-button.tsx`, `export-pdf-button.tsx`
  - `admin/` - Admin panel: `admin-panel.tsx`, `users-tab.tsx`, `products-tab.tsx`, `periods-tab.tsx`, `reminders-tab.tsx`, `settings-tab.tsx`, `stage-assignment-editor.tsx`, `mock-data.ts`
  - `navigation/` - NavBar (`nav-bar.tsx`), AppShell (`app-shell.tsx`)
  - `common/` - Shared: `api-readiness-placeholder.tsx`
  - `providers/` - (empty, reserved for React context providers)
  - `ui/` - Page-specific UI: `confirmation-dialog.tsx`
  - `report/` - (empty, reserved for shared report display components)
  - `report-section/` - (empty, reserved)
  - `head/` - (empty, reserved)

**`apps/web/src/lib/`:**

- Purpose: Client-side utility functions
- Key files:
  - `trpc.ts` - tRPC React client creation (`createTRPCReact<AppRouter>()` + `httpBatchLink` with superjson)
  - `format-date.ts` - Date formatting utilities

**`apps/web/src/server/`:**

- Purpose: Server-side helpers for Next.js server components
- Key files:
  - `auth/session.ts` - JWT cookie extraction and session parsing

**`packages/shared/src/schemas/`:**

- Purpose: All Zod schemas and derived TypeScript types
- Key files:
  - `auth.ts` - `roleSchema`, `userSessionSchema`, `Role`, `UserSession`
  - `report.ts` - All domain schemas: report, sections, items, risks, decisions, priorities, PDF export, admin, reminders, carry-over, archive, periods, stages, settings, pagination (~494 lines)

**`packages/ui/src/components/`:**

- Purpose: shadcn/ui component library
- Structure:
  - `ui/` - Base primitives: alert, avatar, badge, button, card, collapsible, dialog, dropdown-menu, input, label, progress, select, separator, sheet, sidebar, skeleton, sonner, table, tabs, textarea, tooltip
  - Root: Composition components: `data-table.tsx`, `crud-sheet.tsx`, `confirm-dialog.tsx`, `traffic-light-badge.tsx`

## Key File Locations

**Entry Points:**

- `apps/api/src/main.ts`: API server bootstrap (NestJS + tRPC + auth + BullBoard)
- `apps/web/src/app/layout.tsx`: Root HTML layout
- `apps/web/src/app/page.tsx`: Login page (application entry for users)
- `apps/web/src/proxy.ts`: Next.js 16 proxy (replaces middleware.ts) - auth redirect logic

**Configuration:**

- `turbo.json`: Turborepo task definitions (build, dev, lint, typecheck, test)
- `pnpm-workspace.yaml`: Workspace packages (apps/_, packages/_)
- `package.json`: Root scripts, shared devDependencies, pnpm config
- `prisma/schema.prisma`: Database schema (at monorepo root)
- `apps/api/src/infrastructure/config/env.schema.ts`: Environment variable validation
- `apps/web/src/styles/app.css`: Tailwind CSS entry point + utility safelist

**Core Logic:**

- `apps/api/src/infrastructure/trpc/trpc.router.ts`: Central API router (all procedures)
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts`: Auth middleware (public/protected/head)
- `apps/api/src/modules/report-sections/report-sections.service.ts`: Lead report editing logic
- `apps/api/src/modules/publication/publication.service.ts`: Report assembly + publishing
- `packages/shared/src/schemas/report.ts`: All domain data schemas

**Testing:**

- `apps/api/src/modules/*/*.test.ts`: Unit tests (service logic)
- `apps/api/src/modules/*/*.contract.test.ts`: Contract tests (Zod schema validation)
- `apps/api/src/modules/*/*.integration.test.ts`: Integration tests (Prisma)
- `apps/api/src/test-utils/prisma-test-helper.ts`: Shared Prisma test helper
- `apps/web/src/test/fixtures.ts`: Frontend test fixtures
- `apps/web/src/test/msw-handlers.ts`: MSW request handlers
- `apps/web/e2e/`: Playwright E2E tests (currently paused/deleted)

## Naming Conventions

**Files:**

- Domain modules: `{module-name}.{layer}.ts` (e.g., `review.service.ts`, `review.prisma-repository.ts`, `review.module.ts`, `review.router.ts`)
- Tests: `{module-name}.{layer}.test.ts` or `{module-name}.contract.test.ts` or `{module-name}.integration.test.ts`
- React components: `kebab-case.tsx` (e.g., `lead-form.tsx`, `dashboard-page.tsx`)
- Schemas: `{domain}.ts` (e.g., `auth.ts`, `report.ts`)
- UI components: `kebab-case.tsx` matching shadcn/ui convention

**Directories:**

- API modules: `kebab-case` (e.g., `report-sections/`, `carry-over/`, `pdf-export/`)
- Web components: `kebab-case` by domain (e.g., `lead/`, `dashboard/`, `weekly-report/`)
- Infrastructure: `kebab-case` by concern (e.g., `bullmq/`, `prisma/`, `trpc/`)

## Where to Add New Code

**New API Domain Module:**

1. Create directory: `apps/api/src/modules/{name}/`
2. Create `{name}.service.ts`:
   - Define `{Name}DomainError extends Error`
   - Define `{Name}Repository` interface
   - Define `{Name}Service` class (constructor takes repository)
3. Create `{name}.prisma-repository.ts`:
   - `@Injectable()` class implementing the repository interface
   - Constructor takes `PrismaService`
4. Create `{name}.module.ts`:
   - NestJS `@Module` using `useFactory` to inject repo into service
   - Export the service class
5. Add procedures to `apps/api/src/infrastructure/trpc/trpc.router.ts`:
   - Add service to `RouterDeps` type
   - Add new namespace with `protectedProcedure` or `headProcedure`
   - Wrap calls in try/catch with `mapDomainError()`
6. Register module in `apps/api/src/app.module.ts` imports array
7. Resolve service in `apps/api/src/main.ts` `createAppRouter()` call
8. If new domain error exists, add mapping in `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`
9. Add Zod schemas to `packages/shared/src/schemas/report.ts` (or new schema file)
10. Export new types from `packages/shared/src/index.ts`

**New Zod Schema:**

- Add to `packages/shared/src/schemas/report.ts` (if report-domain) or create new file in `packages/shared/src/schemas/`
- Export from `packages/shared/src/index.ts`
- Derive TypeScript types with `z.infer<typeof schema>`

**New Frontend Page:**

- Create route file in `apps/web/src/app/(app)/{role}/{page-name}/page.tsx`
- Create component directory in `apps/web/src/components/{domain}/`
- Page component is a thin wrapper that imports the main component
- Use `<main id="main-content">` with `max-w-6xl` container pattern

**New Frontend Component:**

- Place in `apps/web/src/components/{domain}/{component-name}.tsx`
- Use kebab-case filename
- Import UI primitives from `@customreport/ui` (not local copies)
- Use `'use client'` directive for interactive components

**New UI Primitive (shadcn/ui):**

- Add to `packages/ui/src/components/ui/{name}.tsx`
- Export from `packages/ui/src/index.ts`
- If Tailwind v4 scanner misses classes, add to `apps/web/src/styles/app.css` safelist

**New Shared Utility:**

- API-side: `apps/api/src/lib/` (e.g., new logger, helpers)
- Web-side: `apps/web/src/lib/` (client utils) or `apps/web/src/server/` (server-only)

**New Test:**

- Unit test: co-located as `{name}.test.ts` next to source file
- Contract test: `{name}.contract.test.ts` in module directory
- Integration test: `{name}.integration.test.ts` in module directory
- E2E test: `apps/web/e2e/` (Playwright, currently paused)

## Special Directories

**`prisma/`:**

- Purpose: Database schema and migrations
- Generated: Prisma Client is generated from this schema
- Committed: Yes (schema.prisma is committed; generated client is not)
- Note: Lives at monorepo root, NOT inside apps/api

**`.planning/`:**

- Purpose: GSD workflow planning artifacts, phases, state tracking
- Generated: By GSD commands
- Committed: Yes

**`graphify-out/`:**

- Purpose: Knowledge graph analysis output
- Generated: By `graphify update .` command
- Committed: Yes

**`mockups/`:**

- Purpose: HTML mockup files for UI/UX design reference
- Generated: No (hand-crafted)
- Committed: Yes

**`design-system/`:**

- Purpose: Design system reference and token definitions
- Generated: No
- Committed: Yes

**`.turbo/`:**

- Purpose: Turborepo cache
- Generated: Yes
- Committed: No (gitignored)

**`node_modules/`:**

- Purpose: pnpm dependency store
- Generated: Yes
- Committed: No (gitignored)

---

_Structure analysis: 2026-04-24_
