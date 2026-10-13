# Proposal

## Why

An administrator can overwrite a concurrent period edit and receive an audit
diff that names an obsolete previous value. TASK-503 C0767 reproduces this
through `PeriodAdminService` and PostgreSQL; independent deadline and label
edits already preserve both fields.

## What Changes

- Check the expected values of changed fields under the existing Report lock.
- Check both range boundaries whenever either boundary changes, preserving the
  range used by validation and overlap prechecks.
- Reject stale edits with the existing typed stale-state conflict while keeping
  independent deadline and label patches legitimate.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `period-scheduler-wiring`: manual period patches protect their before-values
  and effective range against concurrent edits.

## Impact

Period admin service, repository port, locked manual writer and their existing
tests. Evidence: `wave-01/api/INPUT.json` C0767 and
`wave-01/native-core-baseline.log` in `/home/user/work/handoffs/task-503`.

## Non-goals

- Schema migrations, version fields, new timestamps or dependency upgrades.
- Global configuration, unrelated lifecycle writers or Backlog changes.
