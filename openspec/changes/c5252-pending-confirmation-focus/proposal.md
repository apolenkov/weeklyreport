# Proposal

## Why

While a Fill From replacement is in flight, the confirmation's buttons become
disabled and keyboard focus silently drops out of the dialog: a native browser
run (C5252, receipt `rt/a-112123-79853`) showed focus on `<body>` after
"Replace & fill" and Tab moving to page content behind the modal. Keyboard and
screen-reader users lose their place in a dialog that cannot be dismissed.

## What Changes

- The Fill From confirmation keeps keyboard focus inside the dialog for the whole
  pending phase: when the clicked action becomes disabled, focus moves to the
  dialog itself, and Tab/Shift+Tab stay inside.
- Unchanged: actions stay disabled and busy while pending, Escape and outside
  clicks stay suppressed, exactly one fill write is requested, focus returns to
  the initiating segment on close.
- The behaviour is implemented once in the shared confirmation dialog, so every
  confirmation with a pending phase gains the same containment (see design.md).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `period-fill-from-ui`: adds the pending-phase focus containment requirement next
  to the existing "returns focus to its initiating segment" requirement.

## Impact

- `apps/web/src/shared/ui/dialogs/confirmation-dialog.tsx` and its test.
- Native regression: `e2e/lead-form/completion.test.ts` "Fill from pending
  replacement blocks dismissal and duplicate writes" (strengthened in C5252 A3).

## Non-goals

- No change to admin entity dialogs (`admin-dialog-focus-management`), to open
  or close focus rules, or to the Fill mutation/write lock.
- No visual focus-indicator acceptance; no screenshot claim.
