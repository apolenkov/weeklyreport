## Context

Two application services orchestrate publishing above one shared repository CAS helper. The duplicated part is NOT the write (already unified per `publish-compare-and-set`) but the after-party: `PeriodService.emitPublishSideEffects` vs the inline tails of `PublicationService.publishReport`/`publishAuto` — same telemetry pair, same "only after a real transition" rule, same swallowed-error ingestion enqueue, two identical `IngestionPublishHook` types (period.service.ts:134, publication.service.ts:26). Separately, `review.publish` → `publishReport` is dead from the product: all three web publish call sites use `trpc.period.publish` (use-weekly-report-mutations.ts, head-publish-lock-action.tsx, use-period-mutations.ts).

## Goals / Non-Goals

**Goals:** one side-effect emission seam; one hook type; no dead manual publish surface.

**Non-Goals:** touching the CAS helper, snapshot strategy, or outcome classification; merging the two services; changing what `period.publish` returns.

## Decisions

1. **New module `apps/api/src/modules/period/application/publish-side-effects.ts`** (period module owns the publish lifecycle) exporting the single `IngestionPublishHook` type and an `emitPublishSideEffects(deps, { reportId, priorStatus, sectionIds? })` function with the discipline: telemetry pair first, then awaited-but-swallowed ingestion enqueue, then analytics-cache invalidation exactly as each caller does today. If the two current call sites order these steps differently, PRESERVE each caller's existing observable order — parameterize, don't unify behavior silently; surface any true conflict in the PR description instead of picking one.
2. **`PublicationService.publishAuto` imports the shared type/module** across the module seam via the existing composition root (`period.module.ts` wires both today) — no new cross-module import zone entries may be needed; if the import-boundary lint fires, wire the function through DI (constructor injection) instead of a direct import, matching how `ingestionHook` is injected today.
3. **Delete `review.publish` + `publishReport`.** `review-publish-target.test.ts` keeps its `review.assembledReport`/`review.dashboard` cases; the publish case moves to a `period.publish` equivalent if not already covered (check `period` router tests first — do not duplicate an existing pin).
4. **No behavior change to auto-publish skip semantics** (`{published:false}` on archived-after-selection) — the side-effect module is called only on the published branch, as today.

## Risks / Trade-offs

- Removing a tRPC procedure is an API-surface change; MVP phase and zero callers make it safe, but the head-facing role-coverage gate must stay green (the procedure uses a canonical `headProcedure` builder — deleting it cannot orphan the middleware chain).
- Cross-module import (publication → period application) may trip Zone 3 boundaries; the DI fallback in Decision 2 is the sanctioned route.
- Telemetry ordering is observable in tests (`manual-publish-telemetry` spec) — the characterization tasks pin order before refactoring.
