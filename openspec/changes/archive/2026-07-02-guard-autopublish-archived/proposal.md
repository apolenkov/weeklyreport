## Why

The auto-publisher scheduler can silently resurrect an admin-archived period back
to `published` state. When an admin archives a draft period, `buildTransition("archive")`
sets `archived=true` and `periodState="archived"` but leaves `status="draft"` (the
`archive` transition does not touch `status` for draft periods). The auto-publisher
candidate query filters only on `{status:"draft", deadline<cutoff}` — no
`archived:false` guard — so the archived period matches and `publishAuto` promotes
it, producing `archived=true, periodStatus="published", periodState="published"`. This
contradicts the `period-dual-state` invariant (the `archived` state must map to
`status="published", archived=true` only when the period was already published, not when
it was a draft) and leaks the period to viewers who read on `periodStatus`.

The sibling auto-archiver already has an `archived:false` guard in its candidate query.
Mirroring that guard in the auto-publisher query removes the common case, but it is not
sufficient on its own. `runOnce` reads candidate ids, then writes per candidate; an admin
archive landing between the read and the write still slips through, because `archive`
leaves `status="draft"` (so the `status==="published"` idempotency guard does not catch it)
and `autoPublish` does not clear `archived`. Closing that read-then-write race requires the
auto-publish write itself to be conditional on the row still being `status="draft"` and
`archived=false`.

## What Changes

- Add `archived: false` to the `findMany` candidate `where` clause in
  `AutoPublisherScheduler.runOnce` so archived periods are excluded before
  `publishAuto` is ever called.
- Guard the auto-publish write with a compare-and-set (only write when the row is
  still `status="draft"` and `archived=false`) so a period archived between
  candidate selection and the write is skipped — closing the read-then-write race.
- Make that skip explicit: when the compare-and-set matches zero rows, propagate a
  skipped outcome from the repository through `publishAuto` to the scheduler so the
  publish success side-effects are NOT fired for the skipped period — no publish
  metrics, no snapshot-ingestion enqueue, no `periodAutoPublish` audit event, no
  missing-section count, and the id excluded from the scheduler's `periodIds`.
  `AssembledReport` exposes neither `archived` nor `periodState`, so the skip cannot
  be inferred from the returned report and must be a discriminated result.
- Add unit-test scenarios: the candidate query asserts on the `findMany` call
  containing `archived:false`, an eligible non-archived draft IS published, an
  archived-after-selection row is skipped by the write guard, and that skip emits
  no metrics, ingestion, audit, missing-section count, or `periodIds`.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `period-dual-state`: add a requirement that the auto-publisher candidate query
  SHALL exclude archived periods, a requirement that the auto-publish write SHALL
  skip periods archived after candidate selection (compare-and-set), and a
  requirement that a zero-row skip SHALL suppress all publish success side-effects
  (metrics, ingestion, audit, missing-section count, `periodIds`) via an explicit
  skipped outcome — together preventing a dual-state divergence where
  `archived=true` and `periodState="published"` coexist, or a skipped period being
  reported as a successful auto-publish.

## Impact

- `apps/api/src/modules/period/auto-publisher.scheduler.ts` — Prisma `where`
  addition (`archived: false`).
- `apps/api/src/modules/publication/publication.prisma-repository.ts` (and/or
  `publication.service.ts`) — compare-and-set guard on the auto-publish write so a
  post-selection archive matches zero rows and is skipped, plus a discriminated
  skipped outcome from `publishAuto` (no metrics/ingestion on the skip branch).
- `apps/api/src/modules/period/auto-publisher.scheduler.ts` — branch on the
  `publishAuto` skipped outcome so the missing-section count, `periodAutoPublish`
  audit, and `periodIds` push are not run for a skipped period.
- `apps/api/src/modules/period/auto-publisher.scheduler.test.ts` and the
  publication repository tests — new candidate-exclusion, regression, and race
  scenarios.
- No schema changes, no API surface changes, no frontend changes.
- Blast radius is narrow: the bug requires `autoPublishAfterDeadline=true` plus an
  admin explicitly archiving a draft period before its deadline+grace passes — a
  reachable but non-default path.

## Non-goals

- Resetting stale `autoPublished`/`autoArchived` audit flags on round-trips
  (tracked separately as `BL-PERIOD-STATE-HYGIENE`).
- Scoping manual publish/reopen to reject archived periods for head users
  (tracked separately as `scope-period-lifecycle-authz`).
