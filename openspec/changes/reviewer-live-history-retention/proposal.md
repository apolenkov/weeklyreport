## Why

Deleting a reviewer currently cascades away live acknowledgements, verdicts and comments. The owner decision for C0038 requires retaining both the referenced user and that history; offboarding must use deactivation.

## What Changes

- Reject user hard deletion while any ReviewAcknowledgement.user, SectionReview.reviewer or RecordComment.reviewer reference exists.
- Replace only those three user foreign keys with ON DELETE RESTRICT using a forward migration.
- Reuse the existing removeUser P2003 typed conflict and deactivation path.
- Add actual PostgreSQL repository coverage for each reference independently, retained rows/deactivation, and reference-free deletion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-entity-write-integrity`: live review-history references retain their user atomically.

## Impact

prisma/schema.prisma, one forward migration and a new admin integration test. Existing admin targeted deletion/publisher retention remains in force. Root owns guarded native PostgreSQL verification and aggregate gates.

## Non-goals

No counts/JavaScript guards, new errors, middleware changes, anonymization, rewriting history, restoration of already cascaded data, or changes to report/section/record/group deletion. Owner policy source: external C0038-final/BRIEF.json.

Backlog execution: TASK-287.03 (Root-owned state).
