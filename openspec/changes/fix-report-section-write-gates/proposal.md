## Why

Wave 0 / P0 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

The two lead-section write paths gate on the wrong report field, and the two
bugs pull in opposite directions:

- `saveDraft` (`report-sections.service.ts`) rejects an edit when the legacy
  `Report.status` column reads `"published"`. Reopen deliberately leaves that
  legacy column at `"published"` (the reopen transition writes only
  `periodStatus`/`periodState`, leaving the legacy tuple untouched), so after a
  head reopens a period every autosave returns `400 SECTION_ALREADY_SUBMITTED`
  while the lead form — whose `readOnly` flag derives from `periodStatus` — still
  presents the form as editable. Reopen editing is functionally dead: the lead
  can type but nothing saves.

- `submitSection` has NO report/period-status gate at all. `validateSubmitInput`
  already rejects a section that is itself `submitted`, so the hole is narrow but
  real: a section still in `draft` inside a `published` report can be submitted,
  which delete-recreates its live `item`/`risk`/`decision` rows. This is not a
  never-happens edge — `publishPeriod` never flips section statuses, so every
  section of a reopen-then-republished period sits in `draft` under a `published`
  report. Within the grace window (or under `allowLateSubmissions`) such a lead
  can rewrite the live rows of a published report, diverging them from the frozen
  `publishedSnapshot` the viewer reads.

Both bugs share one root cause: the write gates consult the legacy status column
instead of the canonical `periodStatus`. The correct value is already reachable —
`fillFrom` reads it through `getReportPeriodStatusForSection` and rejects a
`published` period there.

## What Changes

- `saveDraft` stops gating on `getReportStatus` (the legacy `Report.status`
  column) and instead gates on the section's canonical `periodStatus`: reject the
  write only when `periodStatus === "published"`; allow `"open"` and
  `"reopened"`. This makes reopen editing work again without loosening the
  published lock. The existing `section.status === "submitted"` read-only check is
  kept unchanged.

- `submitSection` gains the same `periodStatus === "published"` gate, applied
  before the destructive save, closing the draft-section-in-a-published-report
  hole. The already-submitted rejection stays where it is (inside
  `validateSubmitInput`); this change does not re-add it.

- The `ReportSectionsRepository` port used by these two methods gains a
  section-keyed period-status lookup mirroring the existing
  `getReportPeriodStatusForSection` on the lead-form repository, so both write
  paths read the same canonical field through one shared query shape rather than
  two divergent lookups.

- Integration coverage: autosave on a `reopened` period succeeds; a submit
  against a `draft` section of a `published` period is rejected and leaves the
  live rows untouched.

## Capabilities

### New Capabilities

- `report-section-write-gates`: the server contract that both lead-section write
  paths (`saveDraft`, `submitSection`) gate editability on the canonical
  `periodStatus`, not the legacy `Report.status` column.

### Modified Capabilities

(none)

## Impact

- `apps/api/src/modules/report-sections/application/report-sections.service.ts`
  (`saveDraft`, `submitSection` gates; `ReportSectionsRepository` port method)
- `apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts`
  (period-status-by-section lookup)
- `apps/api/src/modules/report-sections/application/*` and
  `infrastructure/*` tests (in-memory repo stubs gain the new port method;
  new integration coverage for the reopened-autosave and published-submit cases)

Non-goals: no change to `publishPeriod` section-status handling (leaving
republished sections in `draft` is a separate concern); no change to the
`validateSubmitInput` already-submitted check; no change to the reopen transition
or the legacy `Report.status` column itself.
