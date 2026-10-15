## Why

TASK-503.106 (Opus review of TASK-503.104, item 2). The lead form decides which draft rows are ready to save with a `trim()`-based `hasText`, while the server's `safeText` also treats zero-width and other selected invisible characters as empty. A row whose required text is only such characters therefore passes the client filter, reaches the autosave payload, and the server rejects the whole draft — valid neighbouring rows are not saved.

## What Changes

- Shared exports the exact visible-text predicate that `safeText` applies, so client and server share one definition.
- The lead draft payload and its local-only row count use that predicate: an invisible-only required field keeps its row local, like a blank one, and the rest of the draft saves.
- The activity title/description editor and the item editor refuse invisible-only optional text with the visible-content error instead of saving or clearing it; the server keeps rejecting it.
- Successful text is never trimmed, normalized or stripped by this change.

## Capabilities

### Modified Capabilities

- `lead-form-draft-orchestration`: draft rows follow the server visible-text rule.

## Impact

`packages/shared` (report primitives export), `apps/web` report-sections draft payload, item editor and activity fields editor. The selected invisible set itself is owned by `reject-invisible-only-safe-text` (TASK-503.104, in main as daa25f3d1); `hasVisibleText` is that rule exported unchanged, so the client follows any later change to it.
