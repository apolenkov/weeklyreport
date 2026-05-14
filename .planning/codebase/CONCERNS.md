# Codebase Concerns

**Analysis Date:** 2026-04-24

## 2026-05-14 Refresh

The original 2026-04-24 concerns below are preserved, but several are stale.
Current active concerns for v8.1 closure are:

- PR #5 is mergeable but blocked by GitHub Actions queue/runner state, not by a
  known code failure.
- D-12 item-edit-dialog reset-on-reopen remains unresolved after a previous
  react-compiler-incompatible fix was reverted.
- UFB-011 needs a bounding-box regression for head/lead top spacing; fix only
  if overlap reproduces.
- UFB-014 is now a reconciliation item: current code has StageMultiSelect and
  stageIds, but round-trip coverage must prove items/risks/decisions and
  priorities.
- Product semantics gaps D-6, D-8, D-16, D-17, D-29, D-34, and A35 are
  implementation-eligible after the ADR in
  .planning/tickets/session-leftovers-2026-05-14/ADR.md.
- .planning/graphs was stale before Phase 62; graphify must be rebuilt before
  final audit if runtime permits.

## Tech Debt

### Frontend-API Disconnect (Critical)

- Issue: The entire frontend is driven by hardcoded mock data. Zero tRPC calls from any component. No `QueryClientProvider` or `TRPCProvider` is wired into the React component tree. The tRPC client is defined in `apps/web/src/lib/trpc.ts` but never used by any component.
- Files:
  - `apps/web/src/components/lead/mock-data.ts` (257 lines of mock data)
  - `apps/web/src/components/dashboard/mock-data.ts` (493 lines of mock data)
  - `apps/web/src/components/admin/mock-data.ts` (312 lines of mock data)
  - `apps/web/src/components/lead/lead-form.tsx` (imports 8 MOCK\_\* constants)
  - `apps/web/src/components/dashboard/dashboard-page.tsx` (imports 5 MOCK\_\* constants)
  - `apps/web/src/components/weekly-report/weekly-report-page.tsx` (imports 4 MOCK\_\* constants)
  - `apps/web/src/components/admin/users-tab.tsx` (state initialized from MOCK_USERS)
  - `apps/web/src/components/admin/products-tab.tsx` (state initialized from MOCK_PRODUCTS)
  - `apps/web/src/components/admin/periods-tab.tsx` (state initialized from MOCK_PERIODS)
  - `apps/web/src/components/admin/reminders-tab.tsx` (state initialized from MOCK_REMINDERS)
  - `apps/web/src/components/admin/settings-tab.tsx` (state initialized from MOCK_SETTINGS)
  - `apps/web/src/app/(app)/reports/[reportId]/page.tsx` (imports MOCK_KPI, MOCK_PORTFOLIO, MOCK_PRODUCT_REPORTS)
  - `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx` (same mock imports)
  - `apps/web/src/app/(app)/lead/history/page.tsx` (imports MOCK_HISTORY)
  - `apps/web/src/lib/trpc.ts` (client defined but unused)
- Impact: Every page shows static fake data. No feature is functional end-to-end. The API has 11 tRPC routers with real Prisma repositories, but the frontend cannot communicate with them.
- Fix approach:
  1. Add `QueryClientProvider` + `trpc.Provider` wrapper in `apps/web/src/app/(app)/layout.tsx`
  2. Replace `useState(MOCK_*)` with `trpc.*.useQuery()` calls in each component
  3. Delete the 3 `mock-data.ts` files after wiring is complete
  4. Align frontend types with shared Zod schemas from `@customreport/shared`

### Duplicate Print/View Pages

- Issue: `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx` (534 lines) is a near-complete copy of `apps/web/src/app/(app)/reports/[reportId]/page.tsx` (389 lines). Both contain identical mock data imports, identical component structures, and identical data transformation logic.
- Files:
  - `apps/web/src/app/(app)/reports/[reportId]/page.tsx` (389 lines)
  - `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx` (534 lines)
- Impact: ~900 lines of near-identical code. Changes to the report view must be made in two places. Divergence is inevitable.
- Fix approach: Extract shared report rendering into a `<ReportContent>` component. The print page adds only print-specific CSS/layout wrapping. Both pages import the shared component.

### Systemic `as any` in Prisma Repositories

- Issue: Every Prisma repository that uses `mapPrismaToReportSection` casts the Prisma include result to `any` because the mapper function's input type does not match Prisma's actual generated output type. This is one root cause with a single fix.
- Files:
  - `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts` (lines 100, 110)
  - `apps/api/src/modules/publication/publication.prisma-repository.ts` (lines 35, 71)
  - `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` (lines 144-148)
  - `apps/api/src/modules/archive/archive.prisma-repository.ts` (lines 102-106)
  - `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts` (line 62)
  - `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` (lines 139, 235)
  - `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` (lines 30, 51, 56)
- Impact: Type safety is bypassed at every Prisma-to-domain mapping boundary. Runtime errors from schema mismatches will not be caught at compile time.
- Fix approach: Update `mapPrismaToReportSection` in `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` to accept the actual Prisma include return type (using `Prisma.ReportSectionGetPayload<{ include: typeof reportSectionFullInclude }>` or similar), eliminating all downstream `as any` casts.

### Admin `saveSnapshot` N+1 Queries

- Issue: `AdminPrismaRepository.saveSnapshot()` performs individual `create`/`update` calls inside loops for users, projects, periods, and reminder rules. For N entities, this results in N+3 queries per entity type instead of batched operations.
- Files:
  - `apps/api/src/modules/admin/admin.prisma-repository.ts` (lines 187-349)
- Impact: With 50 users + 30 projects + 20 periods + 10 rules, a single `saveSnapshot` can issue 100+ individual Prisma queries. Also, the initial `getSnapshot()` loads ALL users, projects, periods, reminder rules, and reminder executions with no pagination.
- Fix approach:
  1. Wrap the entire save in a `$transaction` to ensure atomicity
  2. Use `createMany` for new entities and `updateMany` for bulk updates where possible
  3. Add pagination to `getSnapshot()` for reminder executions (which will grow unboundedly)

### `'use client'` on Nearly All Components

- Issue: 37 out of ~40 components use `'use client'` directive. This means the entire application is client-rendered with no server component data fetching, no streaming, and no React Server Component benefits.
- Files: All components in `apps/web/src/components/` (37 files with `'use client'`)
- Impact: Larger JavaScript bundles sent to the client. No server-side data fetching. No streaming or Suspense boundaries. SSR benefits of Next.js 16 are unused.
- Fix approach: When wiring real tRPC data, evaluate which components can be server components (data display) vs. client components (interactive forms). Start with dashboard pages and report views as server components.

### Type Duplication Between Mock Data and Shared Schemas

- Issue: `apps/web/src/components/lead/mock-data.ts` and `apps/web/src/components/dashboard/mock-data.ts` define their own TypeScript types (e.g., `Product`, `KanbanItem`, `RiskEntry`, `KpiData`, `LeadInfo`) that overlap with but do not match the Zod schemas in `packages/shared/src/schemas/report.ts`.
- Files:
  - `apps/web/src/components/lead/mock-data.ts` (types on lines 8-92)
  - `apps/web/src/components/dashboard/mock-data.ts` (types on lines 1-125)
  - `packages/shared/src/schemas/report.ts` (canonical Zod schemas)
- Impact: When the frontend is wired to real API data, every component prop interface will need to be rewritten to match the shared schemas. The current types use different field names (e.g., `productId` vs `id`, `severity` vs `status`) and different structures.
- Fix approach: When replacing mock data with tRPC calls, import types directly from `@customreport/shared` and adapt component props to match.

## Security Considerations

### AUTH_DEV_MODE Fallback to Hardcoded Head Session

- Risk: When `AUTH_DEV_MODE=true` and no valid cookie is present, the tRPC context falls back to a hardcoded `DEV_SESSION` with `role: 'head'` and full admin privileges. If `AUTH_DEV_MODE` is accidentally left enabled in production, all unauthenticated requests get head-level access.
- Files:
  - `apps/api/src/infrastructure/trpc/trpc.context.ts` (lines 7-14, 36-38)
  - `apps/api/src/infrastructure/config/env.schema.ts` (line 10: `AUTH_DEV_MODE` defaults to `'false'`)
- Current mitigation: The env schema defaults `AUTH_DEV_MODE` to `'false'`, and the transform only enables it when the string value is exactly `'true'`.
- Recommendations:
  1. Add a startup-time guard that prevents `AUTH_DEV_MODE=true` when `NODE_ENV=production`
  2. Log a warning at boot when `AUTH_DEV_MODE` is active

### No CSRF Protection

- Risk: The API accepts mutations via tRPC over HTTP POST with cookie-based auth. Without CSRF tokens, a malicious site could craft POST requests that execute mutations (publish report, delete user, etc.) using the victim's session cookie.
- Files:
  - `apps/api/src/main.ts` (CORS + helmet configured, no CSRF)
  - `apps/api/src/infrastructure/trpc/trpc.middleware.ts` (auth middleware checks cookie only)
- Current mitigation: CORS is configured to a single origin (`env.FRONTEND_URL`). SameSite=Lax on the cookie prevents cross-site POST from most browsers.
- Recommendations: Add a CSRF token check or switch to SameSite=Strict for the session cookie. Consider adding a custom header check (e.g., `X-TRPC-Source`) that browsers won't include in cross-origin requests.

### No Rate Limiting

- Risk: No rate limiting on any endpoint. The SAML callback, dev-login, tRPC mutations, and PDF export requests can all be called without throttling.
- Files:
  - `apps/api/src/main.ts` (no rate limit middleware)
  - `apps/api/src/modules/auth/auth.routes.ts` (login endpoints unthrottled)
- Current mitigation: None.
- Recommendations: Add `@nestjs/throttler` or express-rate-limit middleware. Prioritize: auth endpoints (login/callback), PDF export (resource-intensive), and admin mutation endpoints.

### Proxy Skips Auth in Non-Production

- Risk: The Next.js proxy (`apps/web/src/proxy.ts`) returns `NextResponse.next()` without checking the auth cookie when `AUTH_DEV_MODE=true` OR `NODE_ENV !== 'production'`. This means all protected routes are accessible without authentication in development and staging.
- Files:
  - `apps/web/src/proxy.ts` (lines 37-39)
- Current mitigation: This is intentional for local development. However, staging environments that set `NODE_ENV=development` or `NODE_ENV=test` will also bypass auth.
- Recommendations: Use a dedicated `AUTH_BYPASS=true` env var instead of keying off `NODE_ENV`. Ensure staging environments run with `NODE_ENV=production`.

### Role Inferred from URL Path

- Risk: The navbar determines the user's role by inspecting `pathname` (e.g., `/admin` -> admin, `/head` -> head). This is a UI-only concern since the backend enforces roles via tRPC middleware, but it means the navbar shows incorrect role information if a user navigates to a URL outside their role.
- Files:
  - `apps/web/src/components/navigation/nav-bar.tsx` (lines 28-33, `inferRole` function)
- Current mitigation: Backend tRPC middleware (`headProcedure`, `protectedProcedure`) enforces role checks server-side.
- Recommendations: When session is available client-side (via cookie parsing or a `/me` endpoint), derive role from the session, not the URL.

## Performance Bottlenecks

### Unbounded Admin Snapshot Loading

- Problem: `AdminPrismaRepository.getSnapshot()` loads ALL users, ALL projects, ALL periods, ALL reminder rules, and ALL reminder executions in a single call with no pagination or limits.
- Files:
  - `apps/api/src/modules/admin/admin.prisma-repository.ts` (lines 118-131)
- Cause: Five parallel `findMany()` calls with no `take` limits.
- Improvement path: Add `take` limits or pagination, especially for `reminderExecutions` which grows with every reminder sent. Consider lazy-loading executions only when a specific rule is expanded.

### Missing Prisma Database Indexes

- Problem: Several frequently queried columns lack database indexes.
- Files:
  - `prisma/schema.prisma`
- Missing indexes:
  - `Report.status` (filtered in many queries: `{ status: 'draft' }`)
  - `Report.periodStatus` (filtered in weekly report queries: `{ periodStatus: 'open' }`)
  - `ReportSection.authorId` (filtered in `myHistory` query and session lookup)
  - `Item.reportSectionId` (queried via include but no explicit index)
  - `Risk.reportSectionId` (same)
  - `Decision.reportSectionId` (same)
- Improvement path: Add `@@index` directives to `schema.prisma` for these columns. Prisma auto-creates indexes for `@unique` and `@relation` fields, but `status` and `periodStatus` enum filters benefit from explicit indexes.

### pg.Pool Without Configuration

- Problem: `PrismaService` creates a `pg.Pool` with only the connection string and no pool size configuration. The default `max` is 10 connections.
- Files:
  - `apps/api/src/infrastructure/prisma/prisma.service.ts` (line 17)
- Cause: `new pg.Pool({ connectionString })` uses all defaults.
- Improvement path: Configure `max`, `min`, `idleTimeoutMillis`, and `connectionTimeoutMillis` based on expected load. The CLAUDE.md mentions PgBouncer for production, but the application-level pool should still be tuned.

## Fragile Areas

### tRPC Router Monolith

- Files: `apps/api/src/infrastructure/trpc/trpc.router.ts` (480 lines)
- Why fragile: All 11 namespaced routers (reports, review, pdfExport, admin, archive, reminders, carryOver, period, weeklyReport, leadForm) are defined in a single function. Adding a new endpoint requires modifying this file and its growing dependency list. The `RouterDeps` type takes 12 services.
- Safe modification: When adding endpoints, add them within the correct namespace section. Keep the `try { ... } catch { throw mapDomainError(error) }` pattern.
- Test coverage: Contract tests exist per module (`*.contract.test.ts`), but the router itself has no integration test for the full routing/middleware chain.

### Auth Routes Complex Orchestration

- Files: `apps/api/src/modules/auth/auth.routes.ts` (282 lines)
- Why fragile: Contains business logic (auto-create weekly report for leads, build user session, lookup/create users) mixed with Express route mounting. The `ensureWeeklyReport` function creates reports, sections, priorities, and project statuses in sequence without a transaction.
- Safe modification: The `buildUserSession` and `ensureWeeklyReport` functions should be extracted to a dedicated service and wrapped in a Prisma `$transaction`.
- Test coverage: Only an E2E spec exists (`auth.e2e.spec.ts`). The `ensureWeeklyReport` logic has no unit tests.

### Email Service Direct env Access

- Files: `apps/api/src/infrastructure/email/email.service.ts`
- Why fragile: Reads `process.env` directly in the constructor instead of receiving validated config via dependency injection. If `SMTP_PORT` is not a valid number, `Number()` silently returns `NaN`.
- Safe modification: Inject `EnvConfig` (from `env.schema.ts`) into the constructor.
- Test coverage: No tests exist for `EmailService`.

## Scaling Limits

### BullMQ Disabled

- Current capacity: BullMQ module and processors exist but are noted as "disabled" in project memory. PDF export and email reminder workers are defined but may not be active.
- Files:
  - `apps/api/src/infrastructure/bullmq/bullmq.module.ts`
  - `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
  - `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`
- Limit: Without BullMQ, PDF generation runs synchronously in the request cycle, blocking the API. Email reminders cannot be scheduled or retried.
- Scaling path: Re-enable BullMQ, verify Redis connectivity, and ensure the processors are registered in the NestJS module tree.

### Playwright in API Docker Image

- Current capacity: The API Docker image uses `mcr.microsoft.com/playwright:v1.59.0-noble` as the base for the production runner, resulting in a ~1.4GB image.
- Files: `Dockerfile.api` (line 35)
- Limit: Every API instance carries a full Chromium installation. This increases cold start time and memory usage.
- Scaling path: Separate PDF generation into a dedicated microservice or sidecar container. The API image can then use `node:20-alpine` (~150MB).

## Dependencies at Risk

### Dockerfile.web Uses `--no-frozen-lockfile`

- Risk: `Dockerfile.web` (line 19) uses `pnpm install --no-frozen-lockfile`, which allows the lockfile to be modified during build. This means production builds may install different dependency versions than development.
- Files: `Dockerfile.web` (line 19)
- Impact: Non-reproducible builds. A transitive dependency update could introduce bugs in production that don't exist in development.
- Migration plan: Change to `pnpm install --frozen-lockfile` (matching `Dockerfile.api` line 19). If the lockfile is out of sync, fix it in CI before the Docker build.

### Passport + Express Version Mismatch

- Risk: The `passport` library's TypeScript types depend on `express@4`, but the project uses `express@5`. This requires a type cast (`as unknown as passport.Strategy`) at the SAML strategy registration.
- Files: `apps/api/src/modules/auth/auth.routes.ts` (line 179)
- Impact: Minor type safety gap. Functional behavior is correct.
- Migration plan: Monitor `passport` releases for Express 5 type support. No action needed immediately.

## Missing Critical Features

### No Next.js Error Boundaries

- Problem: No `error.tsx`, `loading.tsx`, or `not-found.tsx` files exist anywhere in the `apps/web/src/app/` directory tree.
- Files: `apps/web/src/app/` (no error/loading/not-found files at any route level)
- Blocks: Any unhandled error in a page component crashes the entire page with no recovery UI. No loading states are shown during navigation. 404 pages show the default Next.js error.
- Fix approach: Add at minimum:
  - `apps/web/src/app/error.tsx` (root error boundary)
  - `apps/web/src/app/not-found.tsx` (404 page)
  - `apps/web/src/app/(app)/loading.tsx` (loading skeleton for app pages)
  - `apps/web/src/app/global-error.tsx` (catches root layout errors)

### No Logout UI

- Problem: The backend has a `POST /auth/logout` endpoint that clears the session cookie, but no logout button exists in the frontend UI.
- Files:
  - `apps/api/src/modules/auth/auth.routes.ts` (lines 215-222, logout endpoint exists)
  - `apps/web/src/components/navigation/nav-bar.tsx` (no logout button)
- Blocks: Users cannot sign out of the application.

### No Session Extraction on Frontend

- Problem: The frontend has no mechanism to read the current user's session. The `(app)/layout.tsx` comment notes "When server-side session extraction is implemented (Phase 10+)..." but this has not been done.
- Files:
  - `apps/web/src/app/(app)/layout.tsx` (lines 10-15, comment about future session)
  - `apps/web/src/server/auth/session.ts` (exists but only contains redirect helpers)
- Blocks: Components cannot conditionally render based on user role. The navbar infers role from the URL path instead.

## Test Coverage Gaps

### No Frontend Component Tests

- What's not tested: No unit tests exist for any React component in `apps/web/src/components/`. The test directory contains only `fixtures.ts` and `msw-handlers.ts` (test infrastructure) but no actual test files.
- Files:
  - `apps/web/src/test/fixtures.ts` (test fixtures only)
  - `apps/web/src/test/msw-handlers.ts` (MSW handlers defined but unused)
  - `apps/web/src/components/` (0 test files for 40+ components)
- Risk: UI regressions, broken interactions, and accessibility issues will not be caught before deployment.
- Priority: Medium (backend has good test coverage; frontend is currently static mockups)

### Email Service Untested

- What's not tested: `EmailService` has no unit tests. The SMTP configuration, transport selection, and `sendMail` method are untested.
- Files: `apps/api/src/infrastructure/email/email.service.ts`
- Risk: Email delivery failures or misconfiguration will not be caught.
- Priority: Medium

### `ensureWeeklyReport` Logic Untested

- What's not tested: The auto-creation logic for weekly reports during login (creates Report, ReportSection, Priority, ProjectStatus records) has no unit tests.
- Files: `apps/api/src/modules/auth/auth.routes.ts` (lines 40-111)
- Risk: Race conditions when two leads log in simultaneously for the same week. Non-transactional multi-table writes can leave partial data.
- Priority: High

### E2E Tests in Flux

- What's not tested: Git status shows many E2E test files are deleted (unstaged). The current E2E test suite at `apps/web/e2e/` contains 12 spec files, but their content may be stale given the recent UI redesign (Phase 17).
- Files: `apps/web/e2e/*.spec.ts` (12 files)
- Risk: E2E tests may fail or test outdated UI patterns.
- Priority: Medium (will need rewrite when mock data is replaced with real API calls)

---

_Concerns audit: 2026-04-24_
