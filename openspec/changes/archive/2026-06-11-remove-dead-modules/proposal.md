# Remove Dead Modules: UI Compositions, Pass-Through Routers, requireRole

## Why

Every typecheck/lint/test wave pays for ~800 lines no production path
reaches. Three verified-dead clusters (dossiers `dead-ui-components`
and `middleware-builders`, harvest kernels; re-verified at HEAD
2026-06-10):

1. `packages/ui` ships 4 composition components with zero app imports —
   `DataTable`, `CrudSheet`, `ConfirmDialog`, `TrafficLightBadge` —
   plus a 210-line `data-table.test.tsx` that never executes (the
   package "test" script is `tsc --noEmit`; no vitest config includes
   `packages/ui`) and the orphan `styles/traffic-lights.css`, never
   imported by any stylesheet. 639 LOC across 7 files.
2. `apps/api` pass-through routers are dead: the real transport is
   `trpc.router.ts` calling services directly. `publication.router.ts`
   (53 lines) and `archive.router.ts` (51) are imported only by their
   own service tests; `report-sections.router.ts` (52) has zero
   importers. Meanwhile the LIVE manual-publish path (`period.publish`
   → `PeriodService.publishPeriod`, `period.service.ts:89-121`)
   increments NO metrics — the only increment sites for
   `customreportReportsSubmittedTotal` /
   `customreportPeriodStateTransitionsTotal` sit on the UI-dead
   `publishReport` and the scheduler's `publishAuto`
   (`publication.service.ts:208-212, 259-263`). Every head manual
   publish is invisible to telemetry.
3. `packages/shared` `requireRole` (`trpc/middleware/role.ts:63-94`)
   has zero callers; even its own test imports only `assertRole`.

## What Changes

1. Delete the 4 dead UI compositions, the never-run test + snapshot,
   and the orphan `traffic-lights.css`; prune barrel and README rows.
2. Delete the 3 dead routers and their test imports/describe blocks;
   in the same paired move, add the two missing counters to
   `PeriodService.publishPeriod` — the dead module carried the metrics
   discipline the live path lacks.
3. Delete `requireRole`, keep pure `assertRole`; prune the barrel
   export and stale JSDoc mentions.

`ComingSoonBadge` stays — mandated by
`openspec/specs/deferred-feature-pattern`. The `TrafficLightBadge`
deletion is a verified-dead UI **component** deletion, distinct from
the trafficLight **value/enum** SSOT target recorded in
`architecture-refactor-backlog`, which stays open; any future traffic
badge is rebuilt against that shared enum, recovered via the deletion
commit in git history, never restored as-is.

**Non-goals:** the app-local `data-testid="crud-sheet"` strings in
admin tabs (decoupled; 20+ assertions pin them); removing the mounted
`review.publish` / `review.assembledReport` tRPC surface (bigger call,
separate decision); the remaining 5 test-only module routers
(admin/carry-over/review/pdf-export/reminders — follow-up sweep);
removing the unused `packages/ui` root barrel (observation only);
middleware-chain builder consolidation (owned by
`refactor-trpc-infra-duplication`).

## Sequencing

Wave 0 — independent of everything; land any time. No file overlap
with active changes or the other captured changes. The `requireRole`
deletion lives HERE, not in `refactor-trpc-infra-duplication` — that
proposal cross-references this one, and this proposal points back.
