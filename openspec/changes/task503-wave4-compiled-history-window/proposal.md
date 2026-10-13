# Proposal

## Why

Compiled history silently stops after 100 periods (C2051), so Head and Viewer readers cannot tell whether they see their whole history. TASK-503 / TASK-503.04 adopts an explicit latest-100 window; deferred TASK-503.10 owns future pagination.

## What Changes

- Fetch one extra authorized period to return mandatory `truncated` alongside at most 100 entries.
- Disclose truncation in `/reports` and Head/Viewer period navigation.
- Preserve the total archived-period count under existing role and scope filters.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-history-summary`: Explicit compiled-history window and truncation disclosure, distinct from cursor-paginated personal history.

## Impact

Shared history DTO; weekly-report query/service; reports history hook/panel and Head/Viewer controls. Evidence: `~/work/handoffs/task-503/wave4/verdicts-wave4.json`, C2051, coordinator decision and independent reviewer advice on 2026-10-13. No dependencies or database migration.

## Non-goals

- Cursor pagination, full-history loading, or personal `myHistory` changes.
- Deleting old periods or changing role authorization.
