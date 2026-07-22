# Fix Fill From Published-Period Write Lock

## Why

`LeadFormService.fillFrom` gates on the published-period check
(`assertPeriodNotPublished`, `apps/api/src/modules/report-sections/application/lead-form.service.ts:101-106`,
called at line 143) OUTSIDE any transaction, reading `periodStatus` in one
round-trip and only later calling
`fillFromSection` (`.../infrastructure/lead-form.prisma-repository.ts:310-427`)
in a second, separate `$transaction`. That transaction (356-409) does an
optimistic-concurrency CAS on the target section's own `version` column, then
`deleteMany`/`createMany` on the target's live `Item`/`Risk`/`Decision` rows —
but it never locks the parent `Report` row and never re-checks `periodStatus`
inside the transaction.

A publish that commits in the window between the service's precheck and the
transaction's CAS is invisible to Fill From: publishing never touches
`ReportSection.version`, so the CAS still succeeds. Fill From then overwrites a
now-frozen published period's live rows. The viewer's published SEARCH reads
those LIVE rows (not the frozen snapshot), so it can surface content that is
absent from the report a viewer actually opens — the exact class of bug
`viewer-report-surface-parity` already closed for `saveSection`/`saveDraft`.

The sibling write path, `saveSection`
(`.../infrastructure/report-sections.prisma-repository.ts:109-161`), already
solves this: it opens its transaction with
`SELECT "periodStatus" FROM "Report" WHERE "id" = ... FOR UPDATE` (128-130)
before the version CAS, so a concurrent publish either already committed
(the lock read then sees `"published"` and the save fails closed before any
child delete) or blocks until the save commits. `carry-over.write-transaction.ts`
(`assertTargetEditable`, 121-134) and `review-actions.comment-write.ts` use the
identical pattern. `fillFromSection` is the one lead-section write path still
missing it.

## What Changes

- `fillFromSection` takes the same `Report` row `FOR UPDATE` lock
  `saveSection` takes, as the FIRST statement inside its `$transaction`, and
  re-checks `periodStatus` in-tx (`"open"` or `"reopened"` only) before the
  target-section version CAS. A published (or concurrently-published) period
  fails closed with the existing `LeadFormConstraintError` message, and no
  `deleteMany`/`createMany` runs.
- The service-level `assertPeriodNotPublished` precheck stays as the fast,
  friendly-error path for the common case; the in-tx lock is the closing
  guarantee for the race, not a replacement for the precheck.

## Capabilities

### Added Capabilities

- `fill-from-write-lock` — `fillFromSection` locks the parent `Report` row and
  re-verifies `periodStatus` inside its transaction before mutating a target
  section's live rows, closing the TOCTOU window between the service's
  precheck and the transaction's CAS.

## Impact

- Package: `@customreport/api`
- File: `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts`
  (`fillFromSection`, transaction at lines 356-409)
- Tests: new case(s) in `lead-form.prisma-repository.integration.test.ts` /
  `fill-from.integration.test.ts` covering the race and the plain
  published-period rejection

## Non-goals

- Not changing `saveSection`'s or `revokeSectionSubmission`'s existing lock
  behavior — they already do the right thing and are the pattern this change
  follows.
- Not changing the resolve-not-delete published-lineage guard
  (`getPublishedLineage`, service lines 145-161) — that check is orthogonal
  (it protects a REOPENED period's already-published records) and stays as
  is.
- Not adding a lock to `revokeAllSubmitted`'s bulk `updateMany` — it is a
  single atomic statement with its own `periodStatus` filter already
  (line 297), not a delete-recreate.

## Findings covered

- `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts:361`
  (dataset path: `apps/api/src/modules/lead-form/lead-form.prisma-repository.ts:361`) —
  `fillFromSection`'s transaction CASes only the target section's `version`;
  it takes no `Report` row lock and never re-checks `periodStatus` in-tx. A
  publish committing between the service's `assertPeriodNotPublished`
  precheck (`lead-form.service.ts:143`) and the transaction's CAS is
  undetected — publish never advances `ReportSection.version` — so Fill From
  can rewrite a frozen period's live rows, and the viewer's published SEARCH
  (reads live rows) can then reveal content absent from the frozen report.
  (codex-miss-verified)
