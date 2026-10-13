# Proposal

## Why

A lead can open Delete for an editable decision, receive published-lineage metadata while the confirmation remains open, then remove the protected row from the local draft. TASK-503 C4604 reproduced this through the real editor and query providers; [ADR 0015](../../../docs/adr/0015-a-pozitsiya-is-resolved-never-deleted-once-published.md) requires published decisions to remain resolvable instead of deleted.

## What Changes

- Recheck the current decision lineage lock when opening or confirming deletion.
- Close a refused confirmation without changing the decision list.
- Preserve normal editable deletion, Cancel and current read-only checks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-dialog-lifecycle`: decision delete confirmations respect published-lineage locks received after opening.

## Impact

- `apps/web/src/features/period/ui/decisions-section.tsx`.
- Existing public-dialog cases in `decisions-section-add-signal.test.tsx`.
- Parent Backlog task: TASK-503; durable baseline evidence: `wave-01/web-editor-boundaries-r2.log` in the TASK-503 handoff.

## Non-goals

- No server, persistence, shared-schema, database or other section changes.
- No new dialog, endpoint, dependency, global configuration or registry update.
