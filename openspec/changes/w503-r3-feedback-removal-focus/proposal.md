# Proposal

## Why

Round-3 acceptance (B3R) found a keyboard and screen-reader focus loss in the
feedback workbench. After a confirmed Dismiss the Dismiss button unmounts
(a dismissed record no longer offers it), and after a confirmed Delete the whole
record card unmounts. The workflow restores focus only to the control that
opened it, so focus falls to `<body>` and the user loses their place in the list.

## What Changes

- After a successful Dismiss, focus moves to the `Details` button of the same
  record card.
- After a successful Delete, focus moves to the `Details` button of the adjacent
  record card (the next one, otherwise the previous one); with no remaining card
  it moves to the list heading (`Feedback`).
- When the record disappears from the filtered list after Dismiss (an active
  status filter hides it), the same neighbour-then-heading fallback applies.
- Unchanged: focus still returns to the opener for Edit, Reply and for a
  cancelled or failed Dismiss/Delete; no change to the actions, copy or API.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: adds a focus-continuity requirement for
  Dismiss and Delete.

## Impact

- `apps/web/src/features/product-feedback/ui/` (page, record card, focus helper
  and tests).

## Non-goals

- No change to Edit/Reply focus return, to the delete confirmation dialog or to
  the Agentation widget focus behaviour (see the existing "no replacement focus
  mechanism" requirement, which concerns annotation autofocus only).
- C4737 is a NO-OP and is not part of this change.
