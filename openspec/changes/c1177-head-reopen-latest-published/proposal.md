# Proposal

## Why

A Head may reopen only the latest published period, so one reopen cannot walk
back through history. The rule lives in code (`period.service.ts`
`assertHeadTargetMatches` / `assertNoConcurrentReopen`) but not in the spec, and
the latest-published check runs before the reopen transaction: a newer period
published after the gate (C1177, VERIFY-06) still lets the older one reopen.

## What Changes

- Specify that a Head reopen targets only the latest non-archived published
  period, re-checked inside the reopen transaction; Admin recovery stays exempt.
- Re-check the latest published target inside the existing reopen transaction
  (after the status-graph lock and the single-reopen check) for Head reopens.
- Take the status-graph lock at the start of the Head publish transaction, the
  same lane reopen uses, so a publication still committing cannot be missed by
  the reopen re-check (with no reminder policies nothing else orders them).
- Pin the existing integration scenario to the expected winner (newer period)
  and add a publish↔reopen interleave scenario.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reopen-compare-and-set`: adds the Head latest-published target requirement.

## Impact

`apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`
(reopen re-check and publish status-graph lock),
`apps/api/src/modules/weekly-report/report-lifecycle-ids.prisma-query.ts`
(accepts a transaction client), unit and integration tests in
`modules/period/infrastructure/`.

## Non-goals

- No unique index on reopened periods (Admin recovery may hold a second one).
- No change to the scheduler auto-publish transaction (RepeatableRead; its
  snapshot timing under the lock needs its own analysis) or to the Admin path.
