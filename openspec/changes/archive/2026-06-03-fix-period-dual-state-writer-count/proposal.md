# Fix period-dual-state to list only real Report-period writers

## Problem

The `period-dual-state` durable spec claims six code paths write a `Report`'s
period representation (`periodState` + the legacy year/week/quarter tuple). Two
of the six write NO `Report` period field at all — the spec drifted from the code.
Verified by reading the code (not just the codegraph index):

- **carry-over** — `carry-over.prisma-repository.ts::saveCarryOver` ($transaction)
  writes only child rows: `carryOverExecution`, `carryOverRecord`, `item`,
  `decision`. It never calls `report.update` / `report.create`. The target
  `Report` already carries both representations (set by `period-creator` at
  creation). Spec ref: `period-dual-state/spec.md:27-30`.
- **lead-section save** — the `weekly-report` module performs only
  `report.findFirst` / `findUnique` (reads, zero writes); the actual lead-save
  writes land in `report-sections.prisma-repository.ts::saveSection` (lines
  ~295-379), whose `$transaction` writes `reportSection`, `projectStatus`,
  `stageStatus`, `item`, `risk`, `decision` — never `report`, never
  `periodState`, never `buildTransition`. Spec ref: `period-dual-state/spec.md:13-16,25`.

The genuine Report-period writers (confirmed) all route through
`period-transition.ts::buildTransition`: head-publish (publication), archive,
manual admin edit (`createPeriodManual`), unarchive, the `auto-archiver` and
`period-creator` schedulers, and snapshot-restore (the recognised non-transition
writer with its gate opt-out).

This matters because `period-dual-state` is a durable invariant used in code
review; a wrong writer list makes reviewers look for (or demand) Report writes in
modules that correctly have none, and obscures that `buildTransition` is the
single canonical field-set source.

## Solution

Correct the `period-dual-state` spec so the writer set names only the real
writers and routes the invariant through `buildTransition`:

- Drop carry-over and lead-section-save from the writer list.
- Replace the "Lead section save updates both fields" scenario (factually wrong)
  with the head-publish writer, which is a real period writer.
- Rename "All Six Writers Must Comply" to enumerate the actual writers and state
  they comply by calling `buildTransition` within their own transaction.

This is a documentation/contract correction only — no application code changes.
The code is already correct; the spec is being brought into line with it.

## Non-goals

- No change to any application code or to `buildTransition` itself.
- No change to the CI lifecycle-field gate (it already keys off `buildTransition`).
- Does not address the separate UI role-access findings or the dead-enum findings
  (those are their own changes).
