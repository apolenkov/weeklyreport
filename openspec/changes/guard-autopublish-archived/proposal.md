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
The fix is one-line: mirror that guard in the auto-publisher query.

## What Changes

- Add `archived: false` to the `findMany` candidate `where` clause in
  `AutoPublisherScheduler.runOnce` so archived periods are excluded before
  `publishAuto` is ever called.
- Add a unit-test scenario: an archived draft past its deadline is NOT in the
  published result set after `runOnce`.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `period-dual-state`: add a requirement that the auto-publisher candidate query
  SHALL exclude archived periods, preventing a dual-state divergence where
  `archived=true` and `periodState="published"` coexist.

## Impact

- `apps/api/src/modules/period/auto-publisher.scheduler.ts` — one-line Prisma
  `where` addition.
- `apps/api/src/modules/period/auto-publisher.scheduler.test.ts` — new test
  scenario.
- No schema changes, no API surface changes, no frontend changes.
- Blast radius is narrow: the bug requires `autoPublishAfterDeadline=true` plus an
  admin explicitly archiving a draft period before its deadline+grace passes — a
  reachable but non-default path.

## Non-goals

- Resetting stale `autoPublished`/`autoArchived` audit flags on round-trips
  (tracked separately as `BL-PERIOD-STATE-HYGIENE`).
- Scoping manual publish/reopen to reject archived periods for head users
  (tracked separately as `scope-period-lifecycle-authz`).
- Adding a second guard inside `publishAuto` itself (defense-in-depth
  consideration documented in design, not required by this spec).
