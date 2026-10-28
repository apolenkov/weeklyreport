# Proposal

## Why

`deploy/local-prod/provision-users.sql` upserts the four fixture users with
`ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`. A row that already
holds one of those e-mails is promoted to the fixture role even when its
`samlId` belongs to someone else. Live replay on lane A turned a `viewer` with a
foreign `samlId` into `admin`. The script also has no check of the target
dataset: `current_database()` cannot separate the local stand from production,
because both are named `weeklyreport_production` in `docs/kubernetes.md`.

The operator documentation already promises that "a different `samlId` for the
same e-mail is refused as an identity mismatch", and the existing spec promises
atomic replay. The SQL does not enforce the first promise.

Finding: TASK-503.26 (C0140); evidence in the wave RESULT files and the task
card notes.

## What Changes

- Lock `ReportingGroup` and `User` in `SHARE ROW EXCLUSIVE` mode with `NOWAIT`
  inside the existing transaction, before any identity is read.
- Refuse the whole run before any write when a `User` row is not one of the
  four fixture e-mail/`samlId` pairs, or when a `ReportingGroup` other than the
  fixture group exists. The refusal raises an exception, so psql exits nonzero
  and the transaction rolls back.
- Keep the existing upserts, role assignment, and head assignment for a dataset
  that matches the fixture exactly, so a sequential replay still succeeds.

This is a dataset-shape gate. It does not authenticate the environment, and it
does not add a database-name guard.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-stand-provisioning`: provisioning refuses to change an existing user's
  role or identity outside the fixture set, before any write.

## Impact

Only `deploy/local-prod/provision-users.sql`, its lexical contract test in
`scripts/gates/operations/local-stand-provisioning.test.ts`, and this change's
specifications. No dependency, Helm, or public interface changes. The native
PostgreSQL proof (RED against the current SQL and GREEN after the fix on an
approved synthetic target) is not part of this change's local evidence and
remains open until the owner grants a target.
