# Proposal

## Why

C4801: the lead-pipeline-card scenario "a foreign covering risk colors but does
not count" says the chip renders at the covering severity, while the
requirement text only says a foreign risk MAY color the chip. The live pipeline
floors chips from the lead's own risks only (`LeadFormSyncBridge.Pipeline`), so
a stage covered only by a co-owner's risk stays on-track or empty while the
Risks list beside it shows the blocker. Coordinator policy (VERDICTS-008,
BATCH-04): the display floor uses `displayRisks ?? risks`; the toggle guard and
`annotateOwnRiskCoverage` stay on own risks.

A legal producer exists: a co-owner who still holds at least one stage on the
product keeps a risk tagged with a stage that is now the lead's (admin stage
reassignment does not rewrite stored stage names), and cross-author content is
returned only for products both leads hold.

Backlog: TASK-503 (implementation queue 008, C4801). Source report:
`task-503/wave4/claude-D-C4801/REPORT.md` (external evidence archive).

## What Changes

- The requirement says a foreign covering risk MUST color the chip in Everyone
  mode, matching its scenario.
- The live pipeline floors chips from the displayed risks (own plus foreign in
  Everyone mode); completeness and the toggle guard keep using own risks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-pipeline-card`: foreign covering risks floor the displayed chip.

## Impact

`apps/web/src/features/report-pages/ui/lead/bridges/lead-form-sync-bridge.tsx`
and its colocated test.

## Non-goals

- Whether a foreign risk should block or hint on the lead's own status toggle
  stays a separate policy decision; the toggle keeps its current own-risk guard.
- Completeness, `coveredByOwnRisk`, the read-model mapper and Mine mode are
  unchanged.
