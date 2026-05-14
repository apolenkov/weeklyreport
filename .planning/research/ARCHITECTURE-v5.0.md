# Architecture: v5.0 Production Integration

**Project:** CustomReport
**Researched:** 2026-04-25
**Confidence:** HIGH (all findings from direct codebase inspection)

## Executive Summary

The v4.0 codebase has a clean separation that makes mock-to-real migration tractable: container components (DashboardPage, LeadForm, AdminPanel) import `MOCK_*` constants and pass data down as props to pure presentation children. The tRPC client (`apps/web/src/lib/trpc.ts`) is fully configured with superjson transformer and credential forwarding, but nothing imports it. The Next.js rewrite rule (`/trpc/:path*` -> API) is already in `next.config.ts`. The backend has 36 endpoints across 10 namespaces, all functional with 382 unit tests.

The primary integration challenge is NOT plumbing -- it is **type divergence between mock-data types and Zod schema types**. Mock data uses UI-presentation enums (`on-track`, `at-risk`, `in-progress`, `completed`, `planned`) while Prisma/Zod uses data-layer enums (`green`, `yellow`, `red`, `done`, `in_progress`, `blocked`). Some mock states like `pending` and `planned` have no Zod counterpart at all -- they are computed from data-layer state. This requires a dedicated mapper/transformer layer, not a find-and-replace.

The secondary challenge is **E2E test preservation**: 129 existing Playwright tests assert specific mock-derived strings (`"4/6"`, `"2d 5h"`, `"Olga N."`, `"Week 16"`). The seed must be designed test-backward to produce data that renders these exact values, or every assertion needs rewriting.

---

## Current Architecture (v4.0)

### System Topology

```
Browser
  |
  v
Next.js 16 (apps/web, port 3000)
  |  - App Router with (app) route group
  |  - proxy.ts handles auth redirect (no-op in dev)
  |  - next.config.ts rewrites /trpc/* -> API
  |
  v (HTTP /trpc/:path*)
NestJS 11 (apps/api, port 3001)
  |  - Express adapter with trpc middleware at /trpc
  |  - Cookie-based session (customreport_session JWT)
  |  - AUTH_DEV_MODE=true -> fallback head session
  |  - CorrelationIdMiddleware (x-request-id)
  |
  v
PostgreSQL 15 + Redis 7 (Docker Compose)
```

### Package Dependency Graph

```
packages/shared (@customreport/shared)
  |-- Zod schemas (report.ts, auth.ts)
  |-- Type exports (inferred from schemas)
  |
  +--> apps/api (imports schemas for validation)
  |     |-- Prisma 7 (19 models, schema.prisma)
  |     |-- tRPC router (36 endpoints, 10 namespaces)
  |     |-- Custom AppLogger (NOT pino -- manual JSON + appendFileSync)
  |     |-- BullMQ (PDF export, email reminders)
  |     |-- SAML SSO via @node-saml/passport-saml
  |
  +--> apps/web (imports types for tRPC client)
        |-- tRPC client configured (lib/trpc.ts) but UNUSED
        |-- 3 mock-data.ts files (dashboard, lead, admin)
        |-- 15+ component directories, 38 mock-data imports
        |-- 72 onClick handlers using local state
        |-- 129 E2E tests, all against mock data
```

### tRPC Router Namespaces (36 endpoints)

| Namespace      | Endpoints                                                                                                                                                                                                   | Guard Level        | Frontend Consumer                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------- |
| `reports`      | getActive, myHistory, saveDraft, submit                                                                                                                                                                     | protectedProcedure | LeadForm                                    |
| `review`       | dashboard, assembledReport, publish                                                                                                                                                                         | headProcedure      | DashboardPage, WeeklyReportPage             |
| `pdfExport`    | request, status                                                                                                                                                                                             | headProcedure      | ExportPdfButton                             |
| `admin`        | snapshot, getSettings, updateSettings, saveUser, saveProject, savePeriod, saveReminderRule, deleteUser, deleteProject, deleteReminderRule, saveStageAssignment, deleteStageAssignment, listStageAssignments | headProcedure      | AdminPanel tabs                             |
| `archive`      | list, detail                                                                                                                                                                                                | protectedProcedure | ReportArchiveSection, archive pages         |
| `reminders`    | execute, listExecutions                                                                                                                                                                                     | headProcedure      | RemindersTab                                |
| `carryOver`    | execute                                                                                                                                                                                                     | headProcedure      | (manual trigger)                            |
| `period`       | publish, reopen                                                                                                                                                                                             | headProcedure      | PublishLockButton                           |
| `weeklyReport` | get                                                                                                                                                                                                         | protectedProcedure | WeeklyReportPage                            |
| `leadForm`     | byPeriod, fillFrom, versions, restoreVersion, revoke, requestReopen                                                                                                                                         | mixed              | LeadForm, FillFromButton, VersionHistoryNav |

---

## Integration Architecture for v5.0

### 1. tRPC Provider Wiring (Layout-Level)

**What already exists and works:**

- `apps/web/src/lib/trpc.ts` -- `createTRPCReact<AppRouter>()` + `createTRPCClient()` with superjson and `/trpc` URL
- `@trpc/react-query@11.16.0`, `@tanstack/react-query@5.97.0`, `superjson@2.2.6` all installed in `apps/web/package.json`
- `next.config.ts` -- `/trpc/:path*` rewrite to API port already configured
- `apps/api/src/main.ts` -- tRPC Express middleware mounted at `/trpc` with superjson transformer

**What needs to be built:**

Create a `TRPCProvider` client component that wraps both `trpc.Provider` and `QueryClientProvider`:

```
apps/web/src/app/layout.tsx (root, server component)
  |
  +-- TRPCProvider ('use client')
       |-- QueryClientProvider
       +-- trpc.Provider (with trpc client instance)
            |
            +-- {children}
```

**New file: `apps/web/src/components/providers/trpc-provider.tsx`**

This MUST be a `'use client'` component because `@tanstack/react-query` and `@trpc/react-query` require client-side React context. The provider goes in the root layout (`apps/web/src/app/layout.tsx`), wrapping `{children}` inside `<body>`.

**Critical detail:** The root layout is currently a server component. The provider wrapper must be a separate client component file imported into the server layout. Do NOT mark the root layout as `'use client'`.

**Where NOT to put it:** Do NOT put it in the `(app)/layout.tsx` route group layout -- some pages outside the group (like `/auth/error`) may need query client access for error handling, and the tRPC client is cheap when idle.

**QueryClient safety:** Create QueryClient inside the provider component using `useState` or `useRef`, not as a module-level variable. In Next.js App Router, module-level state is shared across SSR requests, causing data leakage between users.

---

### 2. Type Mapper Layer (Presentation <-> Data)

**This is the hardest part of the migration.**

The mock-data types are a **presentation model**. The Zod schemas are a **data model**. They are intentionally different abstractions. The migration requires a mapper layer that transforms API responses into the shape components already expect.

**Divergence inventory:**

| Mock Type (UI)                                                       | Zod/Prisma Type (DB)                                       | Transformation                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ProductStatus: 'on-track' \| 'at-risk' \| 'blocked'`                | `TrafficLightStatus: 'green' \| 'yellow' \| 'red'`         | `green->on-track, yellow->at-risk, red->blocked`                                                            |
| `LeadStatus: 'submitted' \| 'draft' \| 'pending'`                    | `ReportSectionStatus: 'draft' \| 'submitted'`              | `pending` is computed: section exists, status=draft, no items                                               |
| `ItemStatus: 'in-progress' \| 'completed' \| 'blocked' \| 'planned'` | `ItemWorkflowStatus: 'done' \| 'in_progress' \| 'blocked'` | `done->completed, in_progress->in-progress`; `planned` is computed from `type='next'` items                 |
| `ReportStatus: 'active' \| 'published' \| 'draft'` (archive mock)    | `ReportStatus: 'draft' \| 'published'`                     | `active` is computed: status=draft + is current period                                                      |
| `MockProduct.stages[].status: StageStatus`                           | No direct Zod schema for pipeline stage status             | Computed from ProjectStatus + StageAssignment join                                                          |
| `KpiData` (dashboard)                                                | No single endpoint                                         | Computed from `review.dashboard` + period data                                                              |
| `BlockedAtRiskItem`                                                  | No single endpoint                                         | Derived from assembled report escalations                                                                   |
| `PortfolioProduct` (weekly report)                                   | `PortfolioProductOverview` (Zod)                           | Shape differs: mock has `statusLabel` string, `leads` string; Zod has `leadNames` array, `worstStatus` enum |
| `PeriodStatus: 'open' \| 'published' \| 'reopened'` (admin mock)     | `PeriodStatus` (Zod)                                       | **Match** -- one of the few                                                                                 |

**Recommended approach -- mapper module:**

```
apps/web/src/lib/mappers/
  index.ts              -- barrel export
  traffic-light.ts      -- green/yellow/red <-> on-track/at-risk/blocked
  lead-status.ts        -- ReportSectionStatus + activity -> LeadStatus
  item-status.ts        -- ItemWorkflowStatus + ItemType -> display status
  dashboard.ts          -- Multi-endpoint -> KpiData, LeadInfo[], etc.
  weekly-report.ts      -- WeeklyReportReadModel -> PortfolioProduct[], ProductReport[]
  lead-form.ts          -- API responses -> LeadForm component props
  admin.ts              -- AdminSnapshot -> admin tab props
```

Each mapper is a pure function: `(apiResponse: ZodInferredType) => MockCompatibleType`. This preserves the existing component prop types so child components need ZERO changes.

**Alternative rejected: Change component prop types to match Zod schemas.** This would require modifying every component file (25+) plus every E2E test assertion (129 tests). The mapper approach limits changes to container components only.

---

### 3. Mock-to-Real Migration Strategy (38 files)

**Architecture principle:** Components are already structured as container/presentation. Only containers (3 files + 4 page files) import mock constants. Presentation components receive data via props. Migration changes the data source in containers; children are untouched.

**Migration unit inventory:**

| Container                                     | Mock Imports                                                                                                                        | tRPC Endpoints Needed                                                      | Complexity                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| `dashboard/dashboard-page.tsx`                | MOCK_KPI, MOCK_LEADS, MOCK_BLOCKED_AT_RISK, MOCK_ARCHIVE, MOCK_PENDING_LEADS                                                        | review.dashboard, archive.list, weeklyReport.get                           | HIGH -- KPI is computed from multiple sources            |
| `lead/lead-form.tsx`                          | MOCK_PRODUCTS, MOCK_CURRENT/NEXT_WEEK_ITEMS, MOCK_RISKS, MOCK_DECISIONS, MOCK_PRIORITIES, MOCK_PERIODS, MOCK_VERSIONS, CURRENT_USER | reports.getActive, leadForm.byPeriod, leadForm.versions, reports.myHistory | HIGH -- most mock imports, complex state                 |
| `admin/admin-panel.tsx` (via 6 tabs)          | MOCK_USERS, MOCK_PRODUCTS, MOCK_PERIODS, MOCK_REMINDERS, MOCK_SETTINGS                                                              | admin.snapshot, admin.getSettings                                          | MEDIUM -- snapshot returns everything in one call        |
| `weekly-report/weekly-report-page.tsx`        | MOCK_REPORT_PERIODS, MOCK_PORTFOLIO, MOCK_PRODUCT_REPORTS                                                                           | weeklyReport.get                                                           | MEDIUM -- single endpoint, but significant shape mapping |
| `app/(app)/reports/[reportId]/page.tsx`       | Same as weekly report                                                                                                               | weeklyReport.get by reportId                                               | LOW -- mirrors weekly report                             |
| `app/(app)/reports/[reportId]/print/page.tsx` | Same as above                                                                                                                       | Same                                                                       | LOW                                                      |
| `app/(app)/lead/history/page.tsx`             | MOCK_HISTORY                                                                                                                        | reports.myHistory                                                          | LOW -- direct mapping                                    |

**Child components that need NO changes (25+ files, receive data via props):**

kpi-cards, alert-bar, blocked-at-risk-table, lead-reports-grid, lead-report-card, report-archive-section, toggle-all-button, portfolio-overview-table, product-accordion, period-navigator (both versions), sdlc-pipeline, stage-chip, item-card, current-week-section, next-week-section, risks-section, decisions-section, priorities-section, fill-from-button, version-history-nav, lead-history-list, users-tab, products-tab, periods-tab, reminders-tab, settings-tab, stage-assignment-editor, publish-lock-button, export-pdf-button, confirmation-dialog

**Migration pattern per container:**

```typescript
// BEFORE (dashboard-page.tsx)
import { MOCK_KPI, MOCK_LEADS, ... } from './mock-data';
export function DashboardPage() {
  return <KpiCards data={MOCK_KPI} />;
}

// AFTER (dashboard-page.tsx)
import { trpc } from '@/lib/trpc';
import { mapDashboardData } from '@/lib/mappers/dashboard';
export function DashboardPage() {
  const { data: reviewData, isLoading } = trpc.review.dashboard.useQuery();
  const { data: archiveData } = trpc.archive.list.useQuery();
  if (isLoading) return <DashboardSkeleton />;
  const { kpi, leads, blockedAtRisk, pendingLeads } = mapDashboardData(reviewData, archiveData);
  return <KpiCards data={kpi} />;
}
```

---

### 4. Seed Architecture (Test-Backward Design)

**Critical constraint:** The seed must produce data that, when rendered through mappers + UI, generates the exact strings that 129 E2E tests assert.

**Current seed:** Generic -- `Lead 1..6`, `Project 1..6`, minimal data. One report period with basic items.

**Required seed:** Must match mockup data -- 12 products, 6 named leads (Polenkov A., Maria K., Igor V., Dmitry S., Olga N., Sergey T.), 7 SDLC stages, stage assignments, 2+ report periods with traffic lights, items, risks, decisions, priorities.

**Key assertions to preserve (sampled from E2E tests):**

- `"4/6"` (submissions KPI) -- 4 of 6 leads must have submitted sections
- `"2d 5h"` (deadline KPI) -- either seed produces a fixed-time deadline, or this assertion becomes dynamic
- `"Olga N."` and `"Sergey T."` -- seed must use these exact names for pending leads
- `"Week 16"`, `"Apr 14-20"` -- period labels must match
- `"6 leads"` -- exactly 6 lead users required
- `"12 reports total"` -- archive must contain 12 report periods
- `"Submitted"`, `"Draft"`, `"Pending"` -- status badges derived from section state

**Seed design process:**

1. Extract all E2E assertions that check data-dependent text
2. Map each assertion to the mock-data constant it derives from
3. Design seed to produce API responses that, through mappers, generate those same strings
4. Run existing E2E (still against mock data) to confirm no regression
5. After wiring tRPC, verify E2E passes against real data

---

### 5. Auth Guard Architecture

**What already exists and works:**

| Layer           | File                                                  | Behavior                                                                                                                                                        |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js proxy   | `apps/web/src/proxy.ts`                               | Checks `customreport_session` cookie; redirects to SAML login for `/lead`, `/head`, `/reports`, `/admin`; **no-op when `AUTH_DEV_MODE=true` or non-production** |
| tRPC context    | `apps/api/src/infrastructure/trpc/trpc.context.ts`    | Extracts session from cookie; falls back to DEV_SESSION (`role: head`, fixed UUID) when `AUTH_DEV_MODE=true`                                                    |
| tRPC middleware | `apps/api/src/infrastructure/trpc/trpc.middleware.ts` | `protectedProcedure` requires any session; `headProcedure` requires `role === 'head'`                                                                           |
| Server auth     | `apps/web/src/server/auth/session.ts`                 | `extractSessionToken()` and `parseSessionPayload()` -- utility functions, currently unused by layouts                                                           |

**What v5.0 needs:**

**A. Session-aware (app) layout:**

The `(app)/layout.tsx` is currently a passthrough that renders `<NavBar />` and `{children}`. It needs to read the session cookie and provide user context to client components:

```typescript
// apps/web/src/app/(app)/layout.tsx (server component)
import { cookies } from 'next/headers';

export default async function AppGroupLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('customreport_session')?.value;
  // In dev mode: provide stub user context
  // In prod: decode JWT to extract UserSession
  return (
    <>
      <NavBar user={session} />
      {children}
    </>
  );
}
```

**B. No changes needed to proxy.ts.** The existing redirect logic is correct. The v5.0 constraint says "admin role for full regression" -- role-based route blocking is OUT OF SCOPE for v5.0. Auth work is about wiring the session into the React tree so components show role-appropriate UI.

---

### 6. Logging Architecture

**Correction from milestone brief:** The logger is NOT pino. It is a custom `AppLoggerImpl` at `apps/api/src/lib/logger.ts` with:

- JSON serialization via `JSON.stringify`
- stdout/stderr output via `process.stdout.write` / `process.stderr.write`
- File logging via `appendFileSync` (blocking I/O)
- Daily rotation by filename (`customreport-YYYY-MM-DD.log`)
- File pruning beyond `maxFiles` (default 14)
- `child()` method for context propagation
- `NullLogger` for testing

**Existing gap:** `CorrelationIdMiddleware` generates `x-request-id` on every request but the correlation ID is NOT passed to the logger. The tRPC context factory does not extract it.

**What v5.0 needs:**

**A. Connect correlation ID to logger context:**

```
Current:  Request -> CorrelationIdMiddleware (sets header) -> tRPC handler (no logging context)
Required: Request -> CorrelationIdMiddleware (sets header) -> tRPC context (extracts x-request-id)
          -> logger.child({ correlationId }) per request -> all log entries include correlationId
```

**B. tRPC request/response logging middleware:**

Add a tRPC middleware that logs every procedure call:

- Fields: `correlationId`, `procedure`, `type` (query/mutation), `userId`, `durationMs`
- On error: log error code and message (without stack traces in production)

**C. Frontend error logging:**

- QueryClient `onError` global callback for tRPC error handling
- `window.onerror` / `unhandledrejection` for uncaught errors
- Forward to API via `/api/log` endpoint or dedicated error-reporting tRPC procedure

**D. Optional: Replace appendFileSync with buffered writes.**

The current blocking I/O on every log call is acceptable for 6 users but not production-grade. Options:

- Switch to pino with `pino.destination()` (async, 30x faster) -- recommended
- Keep custom logger but add `fs.createWriteStream` buffering

---

### 7. Playwright E2E Architecture for Real API

**Current state (`apps/web/playwright.config.ts`):**

- `webServer` starts Next.js dev on port 3100 with `AUTH_DEV_MODE=true`
- No API server started -- tests run against mock data rendered client-side
- `auth.setup.ts` writes empty storage state files (no real auth)
- Fixtures provide `leadPage` and `headPage` with role-scoped browser contexts
- 129 tests across 26 spec files

**Required changes for real API integration:**

**A. Test infrastructure -- start API + DB alongside Next.js:**

Playwright config needs multiple webServer entries:

1. PostgreSQL + Redis (Docker Compose or pre-existing)
2. NestJS API server on port 3101 with `AUTH_DEV_MODE=true`
3. Next.js dev server on port 3100

**B. Global setup for database seeding:**

```typescript
// apps/web/e2e/global-setup.ts
export default async function globalSetup() {
  // Reset database to known state (test-backward seed)
  execSync("pnpm --filter @customreport/api exec prisma migrate reset --force");
  execSync("pnpm --filter @customreport/api exec prisma db seed");
}
```

**C. Auth setup rewrite -- real dev-login:**

Replace empty storage states with actual dev-login endpoint calls:

```typescript
// apps/web/e2e/auth.setup.ts (rewritten)
setup("authenticate as lead", async ({ request }) => {
  const response = await request.post("http://127.0.0.1:3101/auth/dev-login", {
    data: { email: "polenkov@customreport.local", role: "lead" },
  });
  // Extract session cookie and write real storage state
});
```

**D. Test isolation strategy:**

- **Per-suite reset:** Use `test.beforeAll` to seed specific data if needed
- **No per-test DB reset:** Too slow for 129 tests
- **Read-heavy tests (majority):** No cleanup needed -- they assert rendered content
- **Write tests (submit, publish, CRUD):** Must either reset in `afterAll` or use unique data per test run
- **Parallel safety:** Run write tests with `test.describe.serial` or use per-worker DB isolation

---

## Integration Dependency Graph

```
                    +-----------------+
                    | Seed Rewrite    |
                    | (test-backward) |
                    +--------+--------+
                             |
                    +--------v--------+
                    | tRPC Provider   |
                    | (layout.tsx)    |
                    +--------+--------+
                             |
                    +--------v--------+
                    | Mapper Layer    |
                    | (lib/mappers/)  |
                    +--------+--------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v----+  +-----v------+  +----v--------+
     | Dashboard   |  | LeadForm   |  | Admin       |
     | migration   |  | migration  |  | migration   |
     +--------+----+  +-----+------+  +----+--------+
              |              |              |
     +--------v----+  +-----v------+  +----v--------+
     | Weekly Rpt  |  | History    |  | Archive     |
     | migration   |  | migration  |  | pages       |
     +-------------+  +------------+  +-------------+
              |              |              |
              +--------------+--------------+
                             |
                    +--------v--------+
                    | E2E Rewrite     |
                    | (per container) |
                    +-----------------+

  PARALLEL TRACKS (no dependencies on mock migration):

  +-----------------+     +------------------+
  | Auth Guards     |     | Logging          |
  | (session in     |     | (correlation ID, |
  |  layout, NavBar |     |  request logging,|
  |  user context)  |     |  file rotation)  |
  +-----------------+     +------------------+
```

---

## Recommended Build Order

### Phase 1: Foundation (no visible changes, no test breakage)

1. **Seed rewrite** -- Redesign `prisma/seed.ts` to produce data matching mock-data.ts constants. 12 products, 6 named leads, realistic items/risks/decisions. Run existing E2E to confirm they still pass (they use mock data, not database).
2. **tRPC Provider** -- Create `trpc-provider.tsx`, wire into root `layout.tsx`. Zero visible impact (no queries yet).
3. **Mapper module** -- Build `apps/web/src/lib/mappers/` with pure functions + unit tests. No imports from containers yet.

### Phase 2: Page-by-page wiring (incremental, testable after each)

1. **Lead History page** -- Simplest migration target (single endpoint `reports.myHistory`, flat data shape). Validate E2E.
2. **Admin Panel** -- `admin.snapshot` returns everything in one call. Wire all 6 tabs (queries first, then mutations for save/delete).
3. **LeadForm** -- Most complex. Wire `reports.getActive`, `leadForm.byPeriod`, `leadForm.versions`. Add mutations for saveDraft, submit, fillFrom, restoreVersion.
4. **Dashboard** -- Requires multiple endpoints. Wire `review.dashboard`, `archive.list`. Compute KPI from real data.
5. **Weekly Report + archive pages** -- Wire `weeklyReport.get`. Shape mapping from `WeeklyReportReadModel`.

### Phase 3: Interactivity (mutations wired to real API)

1. **Submit/Publish/Revoke buttons** -- Wire `reports.submit`, `review.publish`, `leadForm.revoke`, `period.publish`, `period.reopen`.
2. **Status<->Risk auto-sync** -- When stage set to at-risk/blocked, auto-create risk entry; when risk filled, update stage status.
3. **Fill From + Version Restore** -- Wire `leadForm.fillFrom`, `leadForm.restoreVersion`.
4. **PDF Export** -- Wire `pdfExport.request`, `pdfExport.status` with polling.

### Phase 4: Infrastructure (parallel with Phases 2-3)

1. **Auth session in layout** -- Read cookie in `(app)/layout.tsx`, provide user context to NavBar and role-conditional UI.
2. **Logging** -- Connect correlation ID to logger, add tRPC request/response logging middleware, frontend error forwarding.

### Phase 5: E2E Integration

1. **Playwright config update** -- Add API server + DB to webServer, add global setup with seed.
2. **Auth setup rewrite** -- Replace empty storage states with dev-login flow.
3. **E2E assertion updates** -- Migrate tests to work with real API responses (most should pass if seed is test-backward correct).

---

## New & Modified Files

### New Files

| File                                                  | Purpose                                       |
| ----------------------------------------------------- | --------------------------------------------- |
| `apps/web/src/components/providers/trpc-provider.tsx` | `'use client'` wrapper for QueryClient + tRPC |
| `apps/web/src/lib/mappers/index.ts`                   | Barrel export for all mappers                 |
| `apps/web/src/lib/mappers/traffic-light.ts`           | green/yellow/red <-> on-track/at-risk/blocked |
| `apps/web/src/lib/mappers/lead-status.ts`             | Compute LeadStatus from section data          |
| `apps/web/src/lib/mappers/item-status.ts`             | ItemWorkflowStatus -> display ItemStatus      |
| `apps/web/src/lib/mappers/dashboard.ts`               | Multi-endpoint -> DashboardPage props         |
| `apps/web/src/lib/mappers/weekly-report.ts`           | WeeklyReportReadModel -> component props      |
| `apps/web/src/lib/mappers/lead-form.ts`               | API responses -> LeadForm component props     |
| `apps/web/src/lib/mappers/admin.ts`                   | AdminSnapshot -> admin tab props              |
| `apps/web/e2e/global-setup.ts`                        | DB reset + seed before test run               |
| `docker-compose.test.yml`                             | Test-specific infra (DB + Redis)              |

### Modified Files

| File                                                           | Change                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/src/app/layout.tsx`                                  | Wrap children with TRPCProvider                                  |
| `apps/web/src/app/(app)/layout.tsx`                            | Read session cookie, provide user context                        |
| `apps/web/src/components/dashboard/dashboard-page.tsx`         | Replace MOCK\_\* with trpc queries + mappers                     |
| `apps/web/src/components/lead/lead-form.tsx`                   | Replace MOCK\_\* with trpc queries + mappers + mutations         |
| `apps/web/src/components/admin/*.tsx` (admin-panel + 6 tabs)   | Replace admin mock data with trpc queries, add mutation handlers |
| `apps/web/src/components/weekly-report/weekly-report-page.tsx` | Replace mock with trpc query                                     |
| `apps/web/src/app/(app)/lead/history/page.tsx`                 | Replace MOCK_HISTORY with trpc query                             |
| `apps/web/src/app/(app)/reports/[reportId]/page.tsx`           | Replace mock with trpc query by reportId                         |
| `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx`     | Same                                                             |
| `prisma/seed.ts`                                               | Complete rewrite with realistic mock-matching data               |
| `apps/web/playwright.config.ts`                                | Add API server, DB, global-setup                                 |
| `apps/web/e2e/auth.setup.ts`                                   | Real dev-login instead of empty states                           |
| `apps/web/e2e/fixtures.ts`                                     | Update storage state paths if needed                             |
| `apps/api/src/infrastructure/trpc/trpc.context.ts`             | Extract correlationId from request                               |
| `apps/api/src/infrastructure/trpc/trpc.middleware.ts`          | Add request logging middleware                                   |
| `apps/api/src/lib/logger.ts`                                   | Optional: upgrade to pino or add buffered writes                 |

### Files to DELETE after migration

| File                                                           | Reason                              |
| -------------------------------------------------------------- | ----------------------------------- |
| `apps/web/src/components/dashboard/mock-data.ts`               | Replaced by real API data + mappers |
| `apps/web/src/components/lead/mock-data.ts`                    | Replaced by real API data + mappers |
| `apps/web/src/components/admin/mock-data.ts`                   | Replaced by real API data + mappers |
| `apps/web/src/components/common/api-readiness-placeholder.tsx` | Obsolete stub from pre-v3 era       |

---

## Data Flow (Post-Migration)

### Dashboard Page (Read Path)

```
Browser loads /head/dashboard
  -> AppGroupLayout reads session cookie (server component)
  -> DashboardPage renders ('use client' component)
  -> trpc.review.dashboard.useQuery()
  -> trpc.archive.list.useQuery()
  -> trpc.weeklyReport.get.useQuery()
  |
  v (parallel HTTP via httpBatchLink, credentials: 'include')
  GET /trpc/review.dashboard,archive.list,weeklyReport.get
  |
  v (Next.js rewrite -> API:3001/trpc/...)
  NestJS tRPC middleware
  -> createContext: extract session from cookie (or DEV_SESSION)
  -> headProcedure/protectedProcedure guard
  -> Service methods -> Prisma -> PostgreSQL
  -> Response serialized with superjson (preserves Date objects)
  |
  v (response back to browser)
  mapDashboardData(reviewData, archiveData, weeklyData)
  -> { kpi: KpiData, leads: LeadInfo[], blockedAtRisk, pendingLeads }
  -> <KpiCards data={kpi} />
  -> <LeadReportsGrid leads={leads} />
```

### Lead Form (Write Path)

```
User clicks "Submit Report"
  -> LeadForm.handleSubmit()
  -> submitMutation.mutate({ reportSectionId, confirmed: true, ... })
  -> trpc.reports.submit.useMutation()
  -> POST /trpc/reports.submit
  |
  v
  NestJS tRPC handler
  -> submitSectionSchema.parse(input) (Zod validation)
  -> reportSectionsService.submitSection(input)
  -> Prisma transaction: update section status, create version snapshot
  -> Return success
  |
  v (response back to browser)
  -> onSuccess: invalidate queries (refetch active section, dashboard)
  -> UI updates to "Submitted" state (read-only form)
```

---

## Anti-Patterns to Avoid

### 1. Replacing Mock Types with Zod Types in Components

**Why bad:** Would require changing prop types in 25+ presentation components and rewriting E2E assertions. Massive blast radius for zero functional gain.
**Instead:** Keep component prop types as they are. Build mapper functions that transform API data into existing prop shapes. Components stay untouched.

### 2. Marking Container Components as Server Components

**Why bad:** tRPC hooks (`useQuery`, `useMutation`) require React client context. Server components cannot use hooks.
**Instead:** Keep containers as `'use client'`. Use server components only for static layout shells and metadata.

### 3. Module-Level QueryClient

**Why bad:** In Next.js App Router, module-level state leaks across SSR requests -- data from User A could appear for User B.
**Instead:** Create `QueryClient` inside the provider component via `useState(() => new QueryClient(...))`.

### 4. Importing Runtime Code from apps/api in apps/web

**Why bad:** The tRPC client uses `import type { AppRouter }` from the API package -- this is type-only and safe. But if any runtime import leaks (e.g., importing a service class), Node.js-only modules like `@prisma/client` will crash the frontend build.
**Instead:** Ensure all cross-package imports from apps/api in apps/web are `import type` only.

### 5. Running E2E Tests Against Shared Mutable Database

**Why bad:** Tests that write data (submit, publish, CRUD) interfere with each other in parallel mode.
**Instead:** Either run write tests with `test.describe.serial`, or use per-worker DB isolation, or reset state in `afterAll`.

### 6. Finding-and-Replacing Enum Values Instead of Building Mappers

**Why bad:** Some states are computed, not 1:1 mappings. `pending` has no DB enum. `planned` has no DB enum. `active` is a computed state. A find-and-replace will miss these.
**Instead:** Build explicit mapper functions that handle computed states and edge cases with unit tests.

---

## Scalability Considerations

| Concern               | v5.0 (6 leads)                                           | Future (50 leads)                                                           |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| tRPC batching         | httpBatchLink handles 3-5 parallel queries per page load | May need to split into separate batch groups or add server-side aggregation |
| Query invalidation    | Invalidate by key after mutations                        | Add optimistic updates for perceived performance                            |
| Dashboard aggregation | Compute KPI in frontend from 3 queries                   | Move to dedicated backend aggregation endpoint                              |
| Seed data volume      | ~200 rows total                                          | Separate test-seed from production-seed scripts                             |
| E2E parallelism       | Single worker (CI: 1 worker)                             | Need per-worker DB isolation or shared read-only seed                       |

---

## Confidence Assessment

| Area                         | Confidence | Basis                                                                                            |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| tRPC plumbing readiness      | HIGH       | Client, server, rewrite all verified in source files                                             |
| Type divergence analysis     | HIGH       | Line-by-line comparison of mock-data.ts vs report.ts Zod schemas                                 |
| Container/presentation split | HIGH       | All 7 containers and 25+ children inspected                                                      |
| E2E test fragility           | HIGH       | Assertions in head-dashboard.spec.ts and others checked directly                                 |
| Logger implementation        | HIGH       | Custom AppLoggerImpl verified -- NOT pino as brief claimed                                       |
| Auth guard state             | HIGH       | proxy.ts, trpc.context.ts, trpc.middleware.ts all read                                           |
| Build order dependencies     | HIGH       | Dependency chain derived from import graph analysis                                              |
| Seed backward-compatibility  | MEDIUM     | Assertion extraction was sampled, not exhaustive -- full extraction needed during implementation |

---

## Sources

All findings from direct codebase inspection:

- `apps/web/src/lib/trpc.ts` -- tRPC client configuration (superjson, /trpc URL)
- `apps/web/package.json` -- @trpc/react-query@11.16.0, @tanstack/react-query@5.97.0
- `apps/web/next.config.ts` -- /trpc rewrite already configured
- `apps/api/src/infrastructure/trpc/trpc.router.ts` -- 36 endpoints, 10 namespaces
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` -- auth guards (protected, head)
- `apps/api/src/infrastructure/trpc/trpc.context.ts` -- session extraction + DEV_SESSION
- `apps/api/src/main.ts` -- bootstrap, tRPC mount at /trpc
- `apps/web/src/components/dashboard/mock-data.ts` -- dashboard presentation types + MOCK\_\* constants
- `apps/web/src/components/lead/mock-data.ts` -- lead form presentation types + MOCK\_\* constants
- `apps/web/src/components/admin/mock-data.ts` -- admin presentation types + MOCK\_\* constants
- `apps/web/src/components/dashboard/dashboard-page.tsx` -- container importing 5 mock constants
- `apps/web/src/components/lead/lead-form.tsx` -- container importing 9 mock constants
- `packages/shared/src/schemas/report.ts` -- canonical Zod schemas (data-layer types)
- `packages/shared/src/schemas/auth.ts` -- UserSession, Role schemas
- `prisma/schema.prisma` -- 19 models, all enums (green/yellow/red, done/in_progress/blocked)
- `prisma/seed.ts` -- current generic seed (Lead 1..6, Project 1..6)
- `apps/web/playwright.config.ts` -- E2E config (single webServer, no API)
- `apps/web/e2e/auth.setup.ts` -- empty storage states (no real auth)
- `apps/web/e2e/fixtures.ts` -- role-scoped test fixtures (leadPage, headPage)
- `apps/web/e2e/head-dashboard.spec.ts` -- sample E2E with hardcoded mock assertions
- `apps/api/src/lib/logger.ts` -- custom AppLoggerImpl (NOT pino)
- `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts` -- x-request-id generation
- `apps/web/src/proxy.ts` -- auth redirect (no-op in dev)
- `apps/web/src/server/auth/session.ts` -- cookie extraction utilities
- `apps/web/src/app/layout.tsx` -- root layout (server component, no providers)
- `apps/web/src/app/(app)/layout.tsx` -- route group layout (passthrough + NavBar)
- `apps/web/src/components/common/api-readiness-placeholder.tsx` -- obsolete stub
