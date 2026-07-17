## Context

The dependency direction is currently reversed at several seams. Application services import metric singletons and the infrastructure `JobEnqueuer`; `published-lineage.ts` combines pure snapshot/set rules with Prisma queries; and tRPC/bootstrap infrastructure imports internal service/error files. The existing ratchet constrains workspace-level imports but not infrastructure consumers entering API modules.

## Goals / Non-Goals

**Goals:** make the application layer declare the effects it needs, bind those effects in Nest composition roots, make report-section lineage rules independently testable, and give each API module a deliberately small infrastructure-facing public API.

**Non-Goals:** change metric identities, job payloads, retry behavior, lineage semantics, tRPC middleware chains, Prisma schema, or repository placement.

## Decisions

### 1. One narrow application port per effect family

Each of admin, period, publication, report-sections, pdf-export, and reminders declares the minimum telemetry and/or enqueue interface its application service calls. Production adapters wrap the existing Prometheus counters and `JobEnqueuer`; test doubles implement the port directly. Nest modules bind tokens to adapters with `useFactory`/`useExisting` and inject ports into services.

This is preferred over a global observability facade because a broad facade recreates infrastructure coupling behind a generic name and obscures each service's effects.

Before: tRPC/worker → application service → Prometheus/BullMQ singleton.

After: tRPC/worker → application service → application port ← Nest-bound infrastructure adapter → Prometheus/BullMQ.

### 2. Split lineage query from lineage policy

Infrastructure owns the Prisma reads for the current report, frozen published/archived rows, and reopened snapshots. It passes plain candidates/snapshots/rows to pure application/domain functions that collect stable IDs and intersect them with current candidates. Both Prisma repositories use the same infrastructure query object/helper.

The pure layer may use shared JSON-compatible types, but MUST NOT import `PrismaService`, Prisma delegates, or Prisma query shapes.

Before: repository → application `queryPublishedLineage(PrismaService, candidates)` → Prisma.

After: repository → infrastructure lineage query → pure lineage rules → `PublishedLineage`.

### 3. Curated barrels are contracts, not export-all files

Each module barrel exports only services, DI tokens, port types, and error classes required by external infrastructure/module consumers. `trpc.router.ts`, child routers, `trpc.error-mapper.ts`, `main.ts`, `app.module.ts`, processors, and schedulers import through those barrels. Internal module files continue to use direct sibling imports.

The ratchet applies to imports originating under `apps/api/src/infrastructure/**` and bootstrap roots and rejects `modules/<name>/<internal-file>` paths. A checked allowlist covers only unavoidable generated/type-only seams, if any, with a reason.

### 4. Preserve load-bearing invariants

The role-coverage middleware builders and period dual-state writes are untouched. No destructive DB operation or deferred feature is introduced. Port adapters are behavior-preserving wrappers, and parity tests assert exact labels/payloads and error mapping.

## Risks / Trade-offs

- [A port grows into a generic service locator] → Keep interfaces module-owned and method-minimal; review barrel exports in tests/ratchet fixtures.
- [Metric or enqueue parity drifts during rewiring] → Characterize calls before extraction and assert adapter arguments and call counts.
- [Barrels create cycles] → Export leaf contracts only, avoid module classes importing their own barrel, and run the build/typecheck gates after each module.
- [Lineage refactor weakens the delete lock] → Preserve current query cases in repository/integration tests and add pure fixtures for own snapshot, published/archived rows, and reopened snapshots.

## Migration Plan

Land ports/adapters module by module, then move lineage orchestration, then switch public imports and enable the ratchet after all consumers are clean. No data migration or feature flag is required; rollback is a code revert.

## Open Questions

None.
