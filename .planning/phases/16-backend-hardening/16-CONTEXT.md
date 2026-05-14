# Phase 16: Backend Hardening - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend fully conforms to all API contracts; BullMQ queues functional with monitoring; test infrastructure clean and ready to support UI redesign; Docker containerization reviewed and K8s-ready; ThemeProvider wired with system detection.

</domain>

<decisions>
## Implementation Decisions

### BullMQ Re-enablement

- **D-01:** Full re-enablement: add BullMQModule import to AppModule + Redis/queue health indicator on /health endpoint + Bull Board UI at /admin/queues
- **D-02:** Bull Board protected by JWT + admin role guard. For now single admin role (all functions accessible); role granularity deferred to later phase
- **D-03:** Graceful shutdown for BullMQ workers — register onApplicationShutdown to close workers cleanly on container restart
- **D-04:** Processors (PdfExportProcessor, EmailReminderProcessor) already registered as providers — just need DI connection via BullMQModule import

### Docker/Containerization (Full Review)

- **D-05:** Full Docker Compose review: verify all containers (PostgreSQL, Redis, API, Web, migrate), add resource limits, fix port mismatch (Dockerfile.api EXPOSE 3001 vs compose 3002), audit .dockerignore, document K8s migration path
- **D-06:** Keep K8s-ready structure: health checks, proper user isolation, separate images, externalized env config
- **D-07:** Turborepo/monorepo build system: verify `turbo prune` works correctly with BullMQ dependencies, ensure multi-stage builds are optimized

### Regression Test Strategy

- **D-08:** All P0+P1 scenarios from REGRESSION-TEST-SCENARIOS.md as API integration tests (may be more or fewer than 81)
- **D-09:** Extend existing 15 contract/integration test files by module — no separate regression files
- **D-10:** In-memory mocks for test data (continue established Prisma repository mock pattern)

### ThemeProvider Wiring

- **D-11:** System preference detection as default — detect OS dark/light mode, allow user override
- **D-12:** Cookie-based persistence via next-themes (no FOUC on SSR, works with RSC)
- **D-13:** Wire ThemeProvider in layout.tsx + add sun/moon toggle button in nav-user dropdown

### Prisma Migration Scope

- **D-14:** Verify schema alignment between Prisma and Zod — no new migration expected since init already has all columns
- **D-15:** Fix reportId mismatch: make Zod optional (`z.string().uuid().nullable()`) to match Prisma (`String?`). Safer — no data loss, allows rules without report
- **D-16:** Verify seed data survives after any schema adjustments

### MSW Handlers (BE-04)

- Claude's Discretion — update MSW handlers in `apps/web/src/test/msw-handlers.ts` to match current tRPC contracts. Tests already pass (29/29) but handlers may have stale shapes.

### Web Test Failures (BE-05)

- **D-17:** Web tests currently pass (29/29, 0 failures). Verify this is stable. If 24 pre-existing failures were already fixed in Phase 15, mark BE-05 as pre-satisfied with verification.

### Claude's Discretion

- Exact Bull Board route and middleware setup
- Specific health check indicators (liveness vs readiness probes)
- Docker resource limit values (memory, CPU)
- .dockerignore audit specifics
- K8s migration documentation format
- MSW handler update details
- Regression scenario selection from P0/P1 priority list
- Theme toggle icon design and placement details

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### BullMQ Infrastructure

- `apps/api/src/infrastructure/bullmq/bullmq.module.ts` — BullMQ module with Redis connection and queue registration
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts` — PDF export job processor
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` — Email reminder job processor
- `apps/api/src/app.module.ts` — AppModule where BullMQModule must be imported (currently missing)

### Docker/Containerization

- `docker-compose.yml` — Production compose (PostgreSQL, Redis, migrate, api, web)
- `docker-compose.dev.yml` — Dev compose with hot-reload
- `docker-compose.prod.yml` — Production-specific overrides
- `Dockerfile.api` — API multi-stage build (turbo prune, Playwright base for PDF)
- `Dockerfile.web` — Web multi-stage build (turbo prune, Next.js standalone)

### Prisma Schema

- `prisma/schema.prisma` — Database schema (ReminderRule at line 213)
- `packages/shared/src/schemas/report.ts` — Zod schemas (adminReminderRuleSchema at line 198)

### Test Infrastructure

- `.planning/REGRESSION-TEST-SCENARIOS.md` — 1788 scenarios, P0/P1 priorities
- `apps/api/src/modules/*/` — Existing contract/integration test files (15 files, 431 tests)
- `apps/web/src/test/msw-handlers.ts` — MSW handlers for tRPC mocks
- `apps/web/vitest.setup.ts` — Vitest setup with MSW server

### Theme/UI

- `apps/web/src/app/layout.tsx` — Root layout (ThemeProvider must wrap here)
- `packages/ui/src/components/ui/sonner.tsx` — Already uses useTheme() from next-themes
- `apps/web/src/components/navigation/nav-user.tsx` — Theme toggle goes in user dropdown
- `packages/ui/src/styles/globals.css` — OKLCH design tokens (need dark mode overrides)

### Prior Phase Context

- `.planning/phases/13-quality-assurance-polish/13-CONTEXT.md` — Bug fixes, test patterns
- `.planning/phases/15-ui-ux-polish-visual-verification/15-CONTEXT.md` — Design vision, EmptyState, web test fix

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `BullMQModule` (bullmq.module.ts): Complete module with Redis connection, two queues — just needs import in AppModule
- `PdfExportProcessor` + `EmailReminderProcessor`: Already registered as providers in AppModule, already have job processing logic
- 15 contract/integration test files: Established patterns with Prisma repository mocks
- MSW handlers: Existing tRPC mock setup with superjson serialization
- `Toaster` (sonner.tsx): Already imports useTheme from next-themes — will work once ThemeProvider is wired

### Established Patterns

- API tests use in-memory mocks of Prisma repositories
- Docker builds use `turbo prune` for workspace isolation
- Health checks at /health/live endpoint (wget-based in compose)
- tRPC with superjson transformer (feedback memory)

### Integration Points

- BullMQModule → AppModule imports array
- ThemeProvider → layout.tsx wrapping children
- Theme toggle → nav-user.tsx dropdown menu
- Regression tests → existing _.contract.test.ts and_.integration.test.ts files
- Docker fixes → Dockerfile.api EXPOSE port, compose resource limits

</code_context>

<specifics>
## Specific Ideas

- User wants full containerization review for K8s readiness (not just BullMQ fix)
- Bull Board at /admin/queues with admin role guard — single role for now, split later
- Graceful shutdown is important for container orchestration (BullMQ workers must drain)
- Port mismatch between Dockerfile.api (EXPOSE 3001) and docker-compose.yml (3002) needs fixing
- All P0+P1 regression scenarios regardless of exact count (may differ from 81)

</specifics>

<deferred>
## Deferred Ideas

- Bull Board role granularity (separate viewer/admin roles) — future phase
- Real PostgreSQL testcontainers for true integration testing — future consideration
- K8s manifests/Helm charts — future deployment phase
- Dark mode token fine-tuning — Phase 17 UI redesign scope

</deferred>

---

_Phase: 16-backend-hardening_
_Context gathered: 2026-04-21_
