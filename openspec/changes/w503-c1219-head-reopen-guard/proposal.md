# Proposal

## Why

A Head can reopen a second period when another reopen commits after the early scope check. TASK-503 C1219 and the shared C1177 mechanism require the Head decision to remain effective inside the write transaction; Admin recovery must still allow multiple reopened periods.

## What Changes

- Derive a required repository policy from the authenticated server session.
- Serialize every reopen with the existing status-graph barrier before reminder-policy and report locks.
- Recheck absence of non-archived reopened periods inside the Head transaction before the existing lifecycle CAS and child writes.
- Preserve Admin exemption and existing target selection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reopen-compare-and-set`: transactional Head guard across different targets, with Admin recovery exempt.

## Impact

`period.service.ts`, `period.prisma-repository.ts`, their existing unit/integration owners, and explicit direct repository callers. No schema or dependency change. Evidence: existing `period.single-active-reopen.integration.test.ts` Admin recovery and `reopen-compare-and-set/spec.md` CAS contract. Backlog: TASK-503 (coordinator owned).

## Non-goals

- Change the newest reopened target resolver or prohibit legal Admin multiple rows.
- Make latest-published, Settings, or window prechecks transactional; these remain C1177 residuals.
- Add a global unique index, migration, runtime seam, or dependency.
