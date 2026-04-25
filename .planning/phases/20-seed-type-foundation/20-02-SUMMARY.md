---
phase: 20-seed-type-foundation
plan: 02
subsystem: ui
tags: [mappers, types, zod, vitest, presentation-layer]

# Dependency graph
requires:
  - phase: prior
    provides: Zod report schemas (trafficLightStatusSchema, itemWorkflowStatusSchema, reportSectionStatusSchema) and presentation mock types (StageStatus, ItemStatus, LeadStatus)
provides:
  - Pure mapper functions translating API enums (green/yellow/red, done/in_progress/blocked, draft/submitted) to UI enums (on-track/at-risk/blocked/empty, completed/in-progress/blocked/planned, submitted/draft/pending)
  - Computed-state derivation for 'planned' (next-week items without explicit workflow status) and 'pending' (empty draft sections)
  - Self-contained type aliases for both API and UI sides exported from each mapper module
  - Barrel `apps/web/src/lib/mappers/index.ts` re-exporting all 6 mapper functions and 8 type aliases
  - 27 vitest unit tests covering every enum value in both directions plus computed states
affects: [21-trpc-provider, 22-page-wiring, dashboard-container, lead-form-container]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mapper layer: container components import from `@/lib/mappers` to translate tRPC query results before passing to presentation children"
    - "Self-contained mapper modules: each mapper owns canonical types for both sides (no import from mock-data.ts) so consumers depend only on the mapper layer"
    - "Computed presentation states ('planned', 'pending', 'empty') are derived in mapper functions, never stored in DB"
    - "TDD discipline: failing tests written first (RED), minimal implementation (GREEN), verified before commit"

key-files:
  created:
    - apps/web/src/lib/mappers/traffic-light.ts
    - apps/web/src/lib/mappers/traffic-light.test.ts
    - apps/web/src/lib/mappers/item-status.ts
    - apps/web/src/lib/mappers/item-status.test.ts
    - apps/web/src/lib/mappers/lead-status.ts
    - apps/web/src/lib/mappers/lead-status.test.ts
    - apps/web/src/lib/mappers/index.ts
  modified: []

key-decisions:
  - "Self-contained mapper modules — type aliases declared inline (TrafficLightStatus, StageStatus, ItemWorkflowStatus, ItemType, ItemStatus, ReportSectionStatus, LeadStatus) so the mapper layer has zero coupling to either mock-data.ts or @customreport/shared at the type level"
  - "Asymmetric mapper signatures — workflowToItemStatus returns Exclude<ItemStatus, 'planned'> and itemStatusToWorkflow accepts the same exclusion; this makes 'planned' a compile-time error in the wrong direction"
  - "deriveItemStatus precedence: explicit workflowStatus always wins over type-based derivation, so a next-week item with workflowStatus='blocked' renders as 'blocked' (not 'planned')"
  - "deriveLeadStatus uses itemCount (not section presence) as the pending/draft discriminator — matches the user-visible meaning of 'pending' (empty section) vs 'draft' (work started)"

patterns-established:
  - "Mapper module layout: <name>.ts + <name>.test.ts colocated under apps/web/src/lib/mappers/, all re-exported via index.ts"
  - "Test naming: describe(<exported function>) per function, it("maps X to Y") per case, plus a roundtrip describe for invertible mappers"

requirements-completed: [TYPE-01, TYPE-02, TYPE-03]

# Metrics
duration: ~2min
completed: 2026-04-25
---

# Phase 20 Plan 02: Mapper Layer Summary

**Pure mapper layer translating Zod/Prisma API enums to UI presentation enums, with computed-state derivation for 'planned' and 'pending' (no DB equivalents) — 27 vitest unit tests, zero mock-data coupling.**

## Performance

- **Duration:** ~2 min (executor wall time)
- **Started:** 2026-04-25T16:53:21Z
- **Completed:** 2026-04-25T16:55:11Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 (all created)

## Accomplishments
- Three mapper modules cover the three semantic mismatches identified in PITFALLS.md (Pitfall 1): traffic-light enum, item-workflow enum, section-status enum
- Six pure functions exported through a barrel index.ts, ready for container components in subsequent plans to import via `@/lib/mappers`
- Computed presentation states ('planned' for next-week items, 'pending' for empty draft sections, 'empty' for null traffic light) implemented and tested — these have no DB equivalent and must live in the mapper layer
- 27/27 vitest tests pass; TypeScript typecheck passes with no errors

## Task Commits

1. **Task 1: traffic-light + item-status mappers (TDD)** — `989ef8e` (feat)
2. **Task 2: lead-status mapper + barrel index (TDD)** — `b4828a4` (feat)

_Note: Both tasks combined RED+GREEN into a single commit per task (no refactor pass needed; implementations were minimal switch statements)._

## Files Created/Modified

- `apps/web/src/lib/mappers/traffic-light.ts` — `trafficToStageStatus`/`stageStatusToTraffic` plus `TrafficLightStatus` and `StageStatus` type aliases
- `apps/web/src/lib/mappers/traffic-light.test.ts` — 9 tests including a roundtrip case
- `apps/web/src/lib/mappers/item-status.ts` — `workflowToItemStatus`/`itemStatusToWorkflow`/`deriveItemStatus` plus `ItemWorkflowStatus`/`ItemType`/`ItemStatus` aliases
- `apps/web/src/lib/mappers/item-status.test.ts` — 12 tests covering both directions plus all `deriveItemStatus` precedence cases
- `apps/web/src/lib/mappers/lead-status.ts` — `deriveLeadStatus` plus `ReportSectionStatus`/`LeadStatus` aliases
- `apps/web/src/lib/mappers/lead-status.test.ts` — 6 tests including submitted-terminal and itemCount=1 boundary
- `apps/web/src/lib/mappers/index.ts` — Barrel re-exporting all 6 functions and 8 type aliases

## Decisions Made

- **Self-contained type aliases (not re-imported from mock-data.ts or @customreport/shared)** — keeps the mapper layer as the single source of truth for the bridge contract; downstream consumers depend only on the mapper, never both ends.
- **Asymmetric exclusion at the type signature** — `workflowToItemStatus` returns `Exclude<ItemStatus, 'planned'>` and `itemStatusToWorkflow` accepts the same; pushing 'planned' into a compile-time error if a caller tries to roundtrip a computed value.
- **Explicit workflowStatus wins over type in `deriveItemStatus`** — a next-week item with `workflowStatus='blocked'` renders as `'blocked'`, not `'planned'`. Documented in JSDoc and covered by a dedicated test.
- **`deriveLeadStatus` uses itemCount as the pending/draft discriminator** — matches the user-visible meaning per the plan's behaviour table; the optional `hasSection` field from the plan turned out unnecessary because itemCount=0 already covers the "empty draft" case.

## Deviations from Plan

**1. [Rule 3 — Blocking] Verify command rewritten**
- **Found during:** Task 1 verification
- **Issue:** Plan's verify command `pnpm vitest run --project web ...` references a vitest projects config that does not exist in this monorepo (root `package.json` has no `--project` config; `apps/web/vitest.config.ts` defines a single project).
- **Fix:** Used `pnpm exec vitest run <files>` from inside `apps/web` instead — equivalent test target, works against the existing config.
- **Files modified:** none (command-only change, not committed)
- **Verification:** Both runs reported the expected pass count (21 then 27).

**Total deviations:** 1 blocking (command-only).
**Impact on plan:** No scope change. The mapper artifacts and tests match the plan exactly; only the verify invocation differs.

## Issues Encountered

None — RED→GREEN proceeded cleanly for both tasks.

## User Setup Required

None — pure mapper functions, no external services or environment configuration.

## Next Phase Readiness

- Mappers ready to be imported as `@/lib/mappers` in container components (e.g., dashboard list, lead form) once tRPC wiring lands.
- Type aliases are stable; further mappers (date formatting, period read-model translation, admin reminder shape) can land alongside the relevant container plan and follow the same module layout.
- No blockers for Phase 21 (TRPCProvider).

## Self-Check: PASSED

- `apps/web/src/lib/mappers/traffic-light.ts` — FOUND
- `apps/web/src/lib/mappers/traffic-light.test.ts` — FOUND
- `apps/web/src/lib/mappers/item-status.ts` — FOUND
- `apps/web/src/lib/mappers/item-status.test.ts` — FOUND
- `apps/web/src/lib/mappers/lead-status.ts` — FOUND
- `apps/web/src/lib/mappers/lead-status.test.ts` — FOUND
- `apps/web/src/lib/mappers/index.ts` — FOUND
- Commit `989ef8e` — FOUND
- Commit `b4828a4` — FOUND
- Vitest: 27/27 passed
- Typecheck: clean

---
*Phase: 20-seed-type-foundation*
*Completed: 2026-04-25*
