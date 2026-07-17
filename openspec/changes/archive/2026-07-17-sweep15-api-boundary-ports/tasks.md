## 1. Application ports and adapters

- [x] 1.1 Characterize existing metric labels/call timing and enqueue payload/options for admin, period, publication, report-sections, pdf-export, and reminders with focused tests before rewiring.
- [x] 1.2 Define admin and period application-owned telemetry ports, add Prometheus adapters, and bind them in `AdminModule` and `PeriodModule`.
- [x] 1.3 Define publication and report-sections application-owned telemetry ports, add Prometheus adapters, and bind them in their Nest modules.
- [x] 1.4 Define pdf-export telemetry/enqueue ports and reminders enqueue/telemetry ports, adapt the existing metrics and `JobEnqueuer`, and bind them in their Nest modules.
- [x] 1.5 Remove Prometheus registry, BullMQ, job-enqueuer, and worker-observability infrastructure imports from the six application module surfaces and update unit doubles to implement ports.

## 2. Published lineage layering

- [x] 2.1 Extract pure snapshot parsing, stable-ID collection, union, and candidate-intersection rules from `application/published-lineage.ts` with complete fixtures for own, published/archived, and reopened sources.
- [x] 2.2 Implement the Prisma-backed lineage query in report-sections infrastructure with the existing empty-candidate short circuit and query filters.
- [x] 2.3 Route both lead-form and report-sections Prisma repositories through the infrastructure query and prove published-record delete-lock parity in integration/contract tests.
- [x] 2.4 Delete the application-to-Prisma dependency and verify no application/domain lineage file imports Prisma service/delegates.

## 3. Module public APIs and ratchet

- [x] 3.1 Inventory every import from `apps/api/src/infrastructure/**`, `main.ts`, and `app.module.ts` into module internals; classify required service/token/port/error contracts by owner.
- [x] 3.2 Curate non-wildcard public barrels for each consumed module and add only the externally supported contracts.
- [x] 3.3 Reroute `trpc.router.ts` and every child router/procedure module through the owning public barrels without changing `RouterDeps` behavior or middleware-chain builders.
- [x] 3.4 Reroute `trpc.error-mapper.ts`, bootstrap roots, processors, schedulers, and other infrastructure consumers through public barrels and update import-based tests.
- [x] 3.5 Extend the import ratchet to reject infrastructure/bootstrap imports of module-internal paths; add pass/fail fixtures for barrel imports and bypasses.

## 4. Focused verification

- [x] 4.1 Run focused API unit/contract tests for all six port adapters and application services.
- [x] 4.2 Run focused report-sections lineage repository/integration tests and verify unchanged lineage results for published, archived, reopened, and empty candidates.
- [x] 4.3 Run the import-ratchet test/fixture command and `pnpm build` to catch barrel cycles.

## 5. Repository gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck`
- [x] 5.3 `pnpm lint`
- [x] 5.4 `pnpm test`
