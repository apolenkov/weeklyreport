# Proposal

## Why

TASK-503.43 returns a disposition for four frozen wave11 clauses on the shared
`ConfirmDeleteDialog` (C5240 double submit, C5241 focus while pending, C5243 risk
context in the accessible description, C5246 focus restore target). Source reading
shows three observable contract gaps and one needs-evidence seam; none is closed by
this change until a native window observes the public hosts.

## What Changes

- A host that reports `isPending` gets at most one `onConfirm` per pending cycle,
  even for two activations before the host re-renders with pending.
- When pending disables the focused action, focus moves to the dialog panel and
  Tab/Shift+Tab stay inside (same containment as the shared `ConfirmationDialog`).
- The dialog's accessible description reads preview, subtitle, consequence and the
  reversibility note (when shown), in that order.
- Focus restore ignores an explicit trigger node that is no longer connected and
  falls back to the previously focused element while that is still connected; the
  both-gone destination stays undecided. The connected check lives in the shared
  `useDialogFocus` seam (`packages/ui/src/components/ui/dialog-focus.ts`), where
  `restoreFocusRef` is read.
- Unchanged: disabled and busy semantics while pending, Escape and outside-click
  suppression, hosts that do not pass `isPending`, and every other `packages/ui`
  dialog primitive (the seam change touches only the restore branch reached through
  `restoreFocusRef`).

## Capabilities

### New Capabilities

- `shared-confirm-delete-dialog`: confirm/focus/description contracts of the shared
  destructive confirmation.

### Modified Capabilities

None.

## Impact

`apps/web/src/shared/ui/dialogs/confirm-delete-dialog.tsx` and its test, plus the
shared focus seam `packages/ui/src/components/ui/dialog-focus.ts` (the disconnected
explicit target no longer wins the restore). `confirm-delete-dialog.tsx` is the only
consumer of `restoreFocusRef` among the 15 host call sites, and the rest keep their
props (4 pass `isPending`, 1 passes `triggerRef`).
Native proof (request count, activeElement/Tab, assistive technology, removed
opener) is separate and not claimed here.
