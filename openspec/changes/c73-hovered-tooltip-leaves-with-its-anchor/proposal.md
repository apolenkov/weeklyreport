# Proposal

## Why

A slide row shows its status and full text in the shared body-portal tooltip
while the pointer rests on it. The provider keeps that tooltip until `hide()`, a
scroll or a resize, and the anchor's only hide is `onMouseLeave`. A row that
unmounts while hovered never fires `mouseleave`, so the tooltip stays on screen
with no anchor, `pointer-events-none` and no way to dismiss it other than
scrolling (C5180, TASK-503.73).

Admitted ways to unmount a hovered row: a background refetch (the shared query
client sets `refetchOnWindowFocus: true`) that drops or replaces the row while
the pointer rests on it, and the Lead deck's click-to-edit
(`onRowActivate`). Neither was executed here.

## What Changes

- A tooltip shown by an anchor is hidden when that anchor unmounts.
- An unrelated anchor unmounting never hides another anchor's tooltip.

## Scope

This repair shares its implementation with
`c79-lock-badge-tooltip-leaves-with-its-anchor` (TASK-503.79 / C5298).
Carousel geometry (C5159) is unchanged and still requires native verification.

## Open items

- A native observation of the stale tooltip after a real refetch or edit.
- The C5159 native trace.

## Capabilities

### lead-slide-by-product-grid

ADDED: a hovered slide mark's tooltip leaves with its anchor.

## Impact

`sdlc-tooltip.tsx` (`useSdlcTooltip` and its provider),
`slide-article-rows.test.tsx`, and the shared provider's tests.
Slide and lock badge consumers keep their existing public API.
