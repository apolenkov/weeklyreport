# Proposal

## Why

The status slide deck pages with `ArrowLeft`/`ArrowRight` on the deck container.
The handler claims every arrow keydown before checking modifiers: it calls
`preventDefault()` and emits a new index, so Ctrl/Meta/Alt/Shift+Arrow is consumed
by the deck. Those combinations are how the browser and assistive technology
provide their own navigation (Find, word/selection movement, reading commands),
and the deck must leave them alone (C5189, TASK-503.41). The deck's fullscreen
`f` shortcut already ignores modified keys; arrow paging was the exception.

## What Changes

- Arrow paging applies only to unmodified arrow keydowns outside form controls
  and contenteditable content.
- A modified arrow keydown is ignored: no selection is emitted, the rendered
  slide does not change, and the event is not prevented.
- Unmodified paging and the empty-deck no-op stay unchanged.

## Open items

- Native browser/AT reproduction of a hijacked shortcut is unobserved; jsdom
  pins only that the deck leaves modified events unprevented and emits nothing.
- The product accepts this shortcut policy by analogy with the existing
  fullscreen modifier rule; a dedicated product decision or a native AT record
  can still revise it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-slide-rendering`: slide paging shortcuts preserve browser and
  assistive input.

## Impact

`status-slide-deck.tsx` and its focused test under
`apps/web/src/features/slides/ui/`.
