# Proposal

## Why

Administrators can currently appoint a Head to a foreign reporting group, or move the Head while leaving that pointer behind. Accepted owner doc422/ADR178 requires Heads to lead their own group while Admins may lead any number of groups.

## What Changes

- Validate the target group under the existing user lock in ordinary head assignment.
- Validate every retained headed group when changing a user's role or group, including Admin-to-Head transitions.
- Enforce the same policy in snapshot input and the projected final graph, preserving atomic reassignment or clearing together with a user move.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-snapshot-restore`: Head membership consistency for ordinary writes and final restore graphs, with Admin cross-group/multiple-group exceptions.

## Impact

Five API/shared production owners and existing helper/schema/admin integration tests. No migrations, dependencies, authorization changes or UI changes. Related OCR C0653/F1171-4 and root `infra-head-group-consistency`; Root owns tracker linkage and delivery.

## Non-goals

- No new active-user rule for stored head pointers.
- No automatic repair of existing records or changes to review/reopen authorization.
- No transient-state validation that rejects a valid atomic restore.

## Evidence

Accepted Backlog doc422/ADR178; owning `openspec/specs/admin-snapshot-restore/spec.md`; exact owners in external `head-membership-full-scope.json`. Root confirmed a guarded readonly inventory with no mismatches in the observed synthetic snapshot; its wrapper exit was not retained, so that inventory is not runtime acceptance.
