# Design

## Context

`useDialogFocus` (packages/ui) restores focus on close with this order: a
connected explicit `restoreFocusRef`, else the element focused when the dialog
opened (`restoreFocusToPrevious`), else nothing. The Slides host passes no
`triggerRef`. After a successful delete both the item editor's Delete button and
its row are gone, so the "else nothing" branch leaves focus on `<body>`.

## Decision

Add one optional `restoreFocusFallbackRef` to the helper, to `DialogContent`,
and to `ConfirmDeleteDialog`. The helper resolves the target as before and uses
the fallback only when that resolution yields a disconnected or missing node.
The Slides host passes the deck container, which is stable across the delete
refetch. The deck root gets `tabIndex={-1}` so `focus()` can reach it.

The fallback is threaded from `LeadSlidesClient` through `useLeadSlidesDeck`,
`useSlideInlineEditor` and `SlideInlineEditorDialogs`; it is optional, so other
consumers keep their behaviour.

## Alternatives rejected

- Pass the deck as `triggerRef`: it would replace the opener on every close,
  including Cancel while the opener is alive.
- Walk the detached opener's ancestors at open time: needs a per-open ancestor
  chain and does not beat a stable container.
