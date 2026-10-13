# Design

## Context

See proposal.md. The existing history list and archive count already apply published scope and Viewer publication filters. Personal history is independently cursor-paginated.

## Goals / Non-Goals

**Goals:** Make the accepted 100-period bound visible without widening reads or authorization.

**Non-Goals:** No cursor, extra count query, storage deletion, or role-policy changes.

## Decisions

Before: authorized list → take 100 → validate snapshots → entries + archived total → UI assumes completeness.
After: same authorized list/order → take 101 → slice 100 → validate returned snapshots → entries + archived total + truncated → muted status beside period controls and above History grid.

One shared `COMPILED_HISTORY_LIMIT` owns the window for API and UI. The 101st row is a presence probe and is never parsed as a snapshot. `archiveCount` continues to count all archived periods under `historyArchiveCountWhere`, independently of `includeArchive`. Truncation derives only from the current list candidates, never from archived total.

The mandatory boolean is propagated through the repository port and Zod DTO. All callers and fixtures must adopt it; no wire default masks outdated consumers. The UI uses polite `role=status` text only for truncated results, preserving error notices, layouts and design tokens. No new components or styles.

## Risks / Trade-offs

- Older compiled periods remain outside this window → TASK-503.10 pagination returns when an actual scope reaches 80 periods or an older-period request arrives. Synthetic 101-period proof does not trigger the product threshold.
- Counts and list are separate reads → preserve existing read behavior; transaction consistency is outside this bounded package.
- Mixed server/client DTO versions → deploy the shared/API/UI package together; rollback together. No migration, feature flag or destructive operation is required.

Period lifecycle dual-state, canonical middleware roles, scope filtering and database guards remain unchanged.
