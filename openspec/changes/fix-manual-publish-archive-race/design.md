# Design — fix-manual-publish-archive-race

## Context

`make-publish-atomic` (committed `c5627d4e`) made both manual publish writes a
compare-and-set keyed on `periodStatus != "published"`. The scheduler path
(`saveAutoPublishedReport`, `guard-autopublish-archived`) additionally keys on
`status = "draft"` AND `archived = false`. The two MANUAL paths do not key on
`archived`, leaving a TOCTOU: `PeriodService.publishPeriod` reads the row
(`getReportById`, checks `report.archived`), then writes via a separate
`updateMany`; an `archive` transition landing between the two still satisfies the
write predicate (archive leaves `periodStatus` open/reopened), so the archived row
is published.

`scope-period-lifecycle-authz` (`fb7be80c`) added `assertHeadTargetMatches`, but
`publishPeriod` skips it for any `periodStatus === "reopened"` target on the
rationale that `assertNoConcurrentReopen` bounds the system to one head-reopened
period. That rationale has a hole: `assertNoConcurrentReopen` runs only on
`reopenPeriod` and exempts admin, so an admin-reopened historical period is a
second reopened row a head can then publish.

## Goals

- Close the archive↔publish race on both manual paths with a fail-closed write.
- Split the zero-row outcome into idempotent concurrent-publish success vs an
  archived-in-window domain error — never a silent success that hides a contradiction.
- Close the reopened-target bypass without affecting the legitimate
  reopen→fix→republish flow.

## Non-Goals

- NO new archive/unarchive authorization. The head may archive/reopen any period
  (trusted-role product-owner decision); the archive-assisted history walk-back is
  an accepted risk. This change adds no period-frontier guard to archive.
- NO schema/migration change. NO merge of the two publish code paths.
- NO change to `scope-period-lifecycle-authz`'s contract; the reopened fix only
  makes its existing guard hold on the manual publish path.

## Decisions

### D1 — `archived: false` in both manual compare-and-set predicates

`period.prisma-repository.ts::publishPeriod` and
`publication.prisma-repository.ts::publishAssembledReport` add `archived: false`
to the `updateMany` `where`. This is the single point that closes the race — a
pre-write `report.archived` check (period.service already has one) cannot, because
the archive can land after it.

### D2 — Zero-row discriminator via in-transaction re-read

A zero-row match previously meant "concurrent publish won → idempotent success".
With `archived: false` added, it can ALSO mean "archived in the window". The repo
re-reads the row (in the same `$transaction` for the period path; a direct read
for the publication path, which has no surrounding tx) and returns a discriminated
outcome:

- `period.prisma-repository.publishPeriod`: today returns `{ transitioned: boolean }`.
  Widen to `{ transitioned: true } | { transitioned: false; reason: "raced" | "archived" }`
  (or an equivalent enum). `PeriodService.publishPeriod` maps `reason: "archived"`
  to `throw new PeriodScopeError("Archived periods cannot be published.")` — the
  SAME error its pre-write check already throws — and `reason: "raced"` to the
  existing idempotent `{ success: true, reportId }` with no side effects.
- `publication.prisma-repository.publishAssembledReport`: today returns
  `{ status: "already-published" | "raced" | "transitioned"; ... }`. Add
  `status: "archived"`. `PublicationService.publishReport` maps it to a domain
  error (a `PublicationAccessError`-class "Cannot publish an archived report.",
  mapped to FORBIDDEN by `map-domain-errors`), distinct from the `"raced"`
  idempotent-success branch.

The contradictory `archived = true` + `periodStatus = "published"` row is never
written in either path.

### D3 — Reopened target must be the single active reopened period

In `PeriodService.publishPeriod`, replace:

```
if (report.periodStatus !== "reopened") {
  await this.assertHeadTargetMatches(reportId, session, () => getCurrentEditableId());
}
```

with a branch that, for a reopened target, asserts `reportId ===
getReopenedNonArchivedId()` for a non-admin head (admin exempt, mirroring
`assertHeadTargetMatches`/`assertNoConcurrentReopen`). Non-reopened targets keep
the existing `getCurrentEditableId` equality check. Reuse the existing
`getReopenedNonArchivedId` port method (no new port surface needed for D3).

## Test plan

Real-DB integration (`customreport_test`, self-fixtured):

- Archive-in-window, `period.publish`: open period; archive it; then run
  `publishPeriod` — assert the row stays `archived = true`, `periodStatus`
  unchanged (NOT published), and a `PeriodScopeError` is raised. FAILS before D1/D2.
- Archive-in-window, `review.publish`: same against `publishAssembledReport` /
  `PublicationService.publishReport`. FAILS before D1/D2.
- Concurrent-publish still idempotent: two publishes on one open period →
  exactly one transition, the loser returns idempotent success, one set of
  counters (regression guard that D2 did not turn the raced branch into an error).

Unit:

- Reopened bypass closed: a non-admin head publishing a reopened target that is
  not `getReopenedNonArchivedId()` (a second, admin-reopened historical period) is
  rejected with `PeriodScopeError`; FAILS before D3.
- Reopen→republish preserved: a non-admin head publishing the single reopened
  period (its own) succeeds; admin publishing any reopened target succeeds.

All new tests must FAIL on a revert of the corresponding fix (teeth).

## Risks

- Widening the repo return shape touches the port interface and the in-memory
  test repository — a missed in-memory update surfaces only in the integration
  suite (the unit suite excludes `*.integration.test.ts` and turbo can serve a
  cached typecheck). Run `pnpm --filter @customreport/api test:integration` for the
  touched modules.
- D3 must not brick reopen→republish — the preserved-flow unit test is the guard.
