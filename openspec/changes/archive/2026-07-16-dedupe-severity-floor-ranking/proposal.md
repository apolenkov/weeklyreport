## Why

The "covering risk floors status" rule and the severity worst-of ladder are still hand-implemented in two vocabularies: web (`CanonicalStatus` in `apps/web/src/lib/stage-status.ts` / `lead-form-sync-bridge.tsx`) and API (`TrafficLight` in `report-sections.status-derivation.ts`, plus a third rank copy `statusSeverity` in `published-report-snapshot.ts`). Agreement between them is held by comments, not types — a rule change requires two coordinated edits that nothing forces to match. The `architecture-refactor-backlog` spec already records this ranking-logic dedup as the one remaining open follow-up of the traffic-light SSOT arc.

## What Changes

- Move `CanonicalStatus` (type + severity precedence ladder) from `apps/web/src/lib/status-presentation.ts` into `packages/shared`, alongside a single `worstCanonicalStatus` fold and the single risk-severity floor mapping (`"blocked"` → blocked, anything else → at-risk).
- Add the canonical↔traffic-light adapters in `packages/shared` next to the ladder, so each side's vocabulary is a thin adapter over one core.
- Replace the web `moreSevere`/`PRECEDENCE` copy, the web floor reduces (`deriveEffectiveStageStatus`, `applyRiskSeverityFloor`), the API `severityToTraffic` mapping, and the `published-report-snapshot.ts` `statusSeverity` rank with the shared core.
- Keep the web collapse-down semantics (manual at-risk/blocked with no backing risk collapses to on-track) exactly where they are — that rule is genuinely web-only and stays out of the shared core.
- Add one shared characterization test suite over severity × items × risks permutations that both sides' adapters are tested against.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `status-risk-unification`: severity ranking and the risk floor mapping gain one shared home; web and API vocabularies become adapters over it.

## Impact

- Shared: new canonical-status module in `packages/shared/src/schemas/`, exports and tests.
- Web: `apps/web/src/lib/status-presentation.ts`, `apps/web/src/lib/stage-status.ts`, `apps/web/src/features/report-sections/ui/lead-form-sync-bridge.tsx`, import updates across consumers of `CanonicalStatus`.
- API: `apps/api/src/modules/report-sections/infrastructure/report-sections.status-derivation.ts`, `apps/api/src/modules/published-report-snapshot.ts`, the domain `aggregateTrafficLight` helper delegates to the shared fold.
- No schema, tRPC, role, or period dual-state changes. No behavior change anywhere — pure relocation + dedup pinned by characterization tests.

## Non-goals

- Changing any status derivation semantics (floors, collapse-down, empty handling).
- Touching stored statuses, persistence, or the stage-name matching landed by `sweep15-status-derivation-ssot`.
