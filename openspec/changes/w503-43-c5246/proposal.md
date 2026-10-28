# Proposal

## Why

Deleting a record from the Slides inline editor removes its row and the editor
that opened the confirmation. The confirmation then closes with its restore
target gone, and keyboard focus falls to `<body>` (TASK-503.43, C5246; public
native reproduction in `/home/user/work/handoffs/wr-513/s26/waves/chunk-1-RESULT.md`).

## What Changes

- The shared confirmation dialog accepts an optional fallback restore container.
  It is used only when neither the explicit trigger nor the previously focused
  element is still connected when the dialog closes.
- The Slides inline editor passes the deck container as that fallback, and the
  deck container becomes programmatically focusable (`tabIndex={-1}`).
- Unchanged: a connected explicit trigger wins, then a connected previously
  focused element, then nothing (no invented destination outside the fallback).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slide-inline-record-editing`: adds the requirement that focus lands on the
  slide deck after a delete whose opener was removed.

## Impact

Owners: `packages/ui/src/components/ui/dialog-focus.ts` and `dialog.tsx` (helper
and content prop), `apps/web/src/shared/ui/dialogs/confirm-delete-dialog.tsx`,
`apps/web/src/features/slides/ui/` (`lead-slides-client.tsx`,
`use-slide-inline-editor.tsx`, `slide-inline-editor-dialogs.tsx`,
`lead/lead-slides-deck-view.tsx`). No dependency, data or API change.

## Non-goals

- Moving focus to the neighbouring record. The deck container is the only
  fallback target in this change; a neighbour target needs its own change.
- Changing the precedence of explicit trigger and previous element (the
  TASK-503.43 card records that precedence as already correct).
- Native screen-reader or browser verification (separate native window).
