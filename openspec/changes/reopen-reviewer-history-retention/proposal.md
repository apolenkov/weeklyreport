# Proposal

## Why

Deleting a reviewer currently removes the author of an existing reopen decision while leaving its date and note behind. TASK-505 requires that live decision history retain its author, using the existing reviewer-deactivation and deletion-conflict contract.

## What Changes

- Restrict deletion through `ReopenRequest.reviewedById`, matching the three protected review-history relations from C0038.
- Preserve the author, review date and note during deactivation and competing reference/deletion writes.
- Apply a forward migration; historical decisions whose author is already NULL remain unchanged.
- Update reopen-history requirements and extend their real PostgreSQL integration owner.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reopen-requests`: retain a referenced decision author and distinguish legacy NULL authors from system auto-close behavior.

## Impact

`prisma/schema.prisma`, one forward migration, and the existing admin-reviewer-history integration tests. The existing typed deletion conflict and deactivation command are reused. Decision: coordinator wrk-90 [583beb], 2026-10-13 01:43; source inventory: ReopenRequest FK and TASK-505 / final TASK-287 Opus R5.

Non-goals: new snapshot fields, author reconstruction, UI changes, and changes to the other protected reviewer relations.
