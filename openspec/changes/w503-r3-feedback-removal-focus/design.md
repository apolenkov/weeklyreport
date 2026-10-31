# Design

## Context

`FeedbackRecordWorkflows.close()` focuses the opener in `requestAnimationFrame`.
A dismissed record hides its Dismiss action (`showDismiss` is false for
`wont_fix`) and a deleted record leaves the inbox list, so the opener is
detached by the time the frame runs and `focus()` is a silent no-op.

## Decisions

- The page (`ProductFeedbackPage`) owns the list, so it owns the fallback: the
  Dismiss and Delete handlers resolve the neighbour from the rendered `items`
  before the write, and after the write succeeds schedule one focus move.
- The target is looked up by DOM id after the frame: `Details` button of the
  record (`feedback-details-toggle-<id>`), then of the neighbour, then the list
  heading (`feedback-list-heading`, `tabIndex=-1`). The first one present wins,
  so a record still in the list keeps focus on its own `Details`.
- The workflow's opener restore is unchanged; it already no-ops for a detached
  opener, and for a still-attached one it runs after the fallback, which is the
  correct final owner.
- `Details` rather than the card itself: an `article` has no accessible name or
  focus role, whereas the button is the first action of every card.

## Assumptions

- Neighbour order is the rendered (filtered) list order.
- The list heading is the page `h1`; making it programmatically focusable does
  not change tab order.
