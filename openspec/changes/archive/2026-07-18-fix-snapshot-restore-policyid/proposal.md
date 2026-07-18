# Fix Snapshot Restore Policy ID

## Why

`getSnapshot` reads each reminder rule's `policyId` (`admin-snapshot.queries.ts:113`)
and the shared `AdminSnapshot` schema carries it
(`packages/shared/src/schemas/report.schema.ts:184`), so the field is part of
the exported snapshot contract.

`upsertReminderRules` in `admin-snapshot-write.queries.ts` builds `ruleData`
without `policyId` (lines 165–172) and uses that same object on both the
`update` and `create` branches (lines 175–182). On a `getSnapshot` →
`saveSnapshot` restore into a fresh database, every reminder rule that was
derived from a `ReminderPolicy` is recreated with `policyId` left at its
column default (`null`), silently detaching the rule from its owning policy.
The FK and its index exist in the schema (`prisma/schema.prisma:546-561`)
specifically to preserve this linkage, so the read path exports data the
write path throws away.

## What Changes

- Add `policyId: rule.policyId` to the `ruleData` object in
  `upsertReminderRules` so both the create and update branches persist the
  policy linkage from the snapshot.
- Restore `ReminderPolicy` rows (`upsertReminderPolicies`, from
  `snapshot.policies`) inside the same transaction BEFORE the rules —
  without this the persisted FK cannot resolve on a fresh database and the
  whole restore rolls back with P2003. (ADDED during implementation:
  adversarial verify reproduced the FK crash; persisting the FK alone is
  not a complete fix.) Unlike the live `saveReminderPolicy` path, the
  restore does not cascade `active` onto rule statuses — the snapshot
  writes each rule's own status explicitly.
- Add a restore-roundtrip regression test: seed a policy + a reminder rule
  with a non-null `policyId`, run getSnapshot, delete BOTH rows (fresh-DB
  path), saveSnapshot, and assert the rule's `policyId` and the policy row
  itself are restored; then null the live rule's FK and restore again to
  cover the update branch.

## Capabilities

### Modified Capabilities

- `admin-snapshot-restore` — restoring a snapshot now preserves each reminder
  rule's `policyId` on both the create and update branch instead of dropping
  it to `null`.

## Impact

- Package: `@customreport/api`
- File: `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`
  (`upsertReminderRules`)
- Tests: new/updated case in the api's admin snapshot integration test
  covering the restore roundtrip
- No schema change — `ReminderRule.policyId` already exists and is already
  read by `getSnapshot`

## Non-goals

- Not touching `upsertProjects`, `upsertPeriods`, or any other
  `upsert*` function in this file — no other field was found missing from
  its `ruleData`/equivalent object.
- Not changing the `PolicyApplicatorService` derivation logic that creates
  rules from policies on new periods — this change only affects the
  snapshot restore path, not first-time policy application.
- Not adding a delete/detach path for rules whose policy no longer exists in
  the snapshot — `saveSnapshot` remains additive-only per its existing
  contract.

## Follow-ups (out of scope, pre-existing)

- Restore-time `applyToPeriod(newPeriod)` omits `now`, so restoring an old
  snapshot can materialize already-elapsed derived rules as `active` (stale
  dispatch on the next tick). Identical behavior existed before this change.
- The applicator's upsert re-derives fireAt/kind/timezone/status for rules
  of active policies on newly-created periods. This is its designed
  idempotent materialization (policy is the source of truth for derived
  rules), not a restore defect.
