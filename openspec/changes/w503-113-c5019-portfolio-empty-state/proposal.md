# Proposal

## Why

TASK-503.113 finding C5019 (card TASK-503.68, policy 15.10 explicit empty
state): a published report with no section content renders an empty Portfolio
Overview grid and no empty state. The published-status clause in the
`ReportContent` gate (`weekly-report-content.tsx`) excludes published reports
from the no-content empty state. The clause was added in refactor `02fdc292e`
without a documented rationale in any spec or ADR.

## What Changes

- Show the existing `ReportEmptyState` for a published report that has no
  section content, so the gate keys off full content for every period status.
- The Portfolio Overview table is unchanged.
- Add a head-report-visibility scenario for the published case next to the
  live scenario.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `head-report-visibility`: the no-content empty state applies to published
  reports as well as live reports.

## Impact

- `apps/web/src/features/report-pages/ui/weekly/weekly-report-content.tsx`
  (`ReportContent` gate) and its colocated test.
- Backlog: TASK-503.113 (finding C5019).
- Not proven here: browser/e2e publish-to-read flow (NOT-PROVEN).
