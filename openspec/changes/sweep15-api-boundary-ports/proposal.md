## Why

Application services in six API modules reach directly into Prometheus and BullMQ, published-lineage orchestration depends on Prisma from `application/`, and the tRPC adapter bypasses module public APIs. The P2 architecture inventory in `docs/reviews/2026-07-15-external-sweep.md` shows these seams can drift without the import ratchet noticing.

## What Changes

- Define application-owned telemetry and enqueue ports in admin, period, publication, report-sections, pdf-export, and reminders; bind Prometheus/BullMQ adapters in Nest composition roots.
- Move `queryPublishedLineage` database orchestration into report-sections infrastructure while keeping snapshot parsing and lineage-set rules pure in application/domain code.
- Curate module `index.ts` barrels for service and error contracts consumed by infrastructure; route `trpc.router.ts`, child routers, error mapping, `main.ts`, and other infrastructure consumers through them.
- Extend the import-boundary ratchet so infrastructure-to-module imports may target only each module's public barrel.

## Capabilities

### New Capabilities

- `api-module-boundary`: Application-owned ports, infrastructure composition, lineage layering, and module public API enforcement.

### Modified Capabilities

- `lint-max-strictness-standard`: The import-boundary requirement gains an infrastructure-to-module public-barrel rule.

## Impact

Touches the six module application services and Nest modules, report-sections lineage files/repositories, API module barrels, tRPC infrastructure imports, error mapping, bootstrap consumers, ESLint boundary configuration, and focused contract tests. No tRPC wire shape, database schema, metric name/labels, queue payload, or lineage behavior changes.

## Non-goals

- No repository-wide clean-architecture rewrite or relocation of Prisma repositories already in infrastructure.
- No telemetry redesign, queue semantics change, or published-lineage policy change.
- No role middleware or tRPC procedure behavior change.
