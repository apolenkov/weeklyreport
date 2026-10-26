# Proposal

## Why

`LockBadge` shows its read-only explanation through the shared
`SdlcTooltipProvider` on `mouseenter` and hides it on `mouseleave`. The provider
keeps one portal tooltip until `hide()`, a scroll or a resize, and a node that is
removed while hovered never fires `mouseleave`. A lock badge on a card that is
filtered out, removed or re-rendered under a resting pointer therefore leaves a
tooltip on screen with no anchor (C5298, TASK-503.79). Consumers in removable or
filterable lists: `risk-card-parts.tsx`, `decision-card.tsx`,
`item-card-actions.tsx`.

The same defect exists for the slide row marks (C5180, change
`c73-hovered-tooltip-leaves-with-its-anchor`). One owner-scoped fix in the shared
tooltip hook serves every consumer and satisfies both changes' tests.

## What Changes

- A tooltip shown by an anchor is hidden when that anchor unmounts.
- An unrelated anchor unmounting never hides another anchor's tooltip.

## Scope

This change repairs lifecycle ownership only. It does not change positioning,
arrow geometry, pending dialogs, or the native evidence requirements for C5262,
C5264, C5255 and C5370. Those clauses remain open in TASK-503.79.

## Open items

- Native observations for C5262, C5264, C5255 and the C5370 arrow boxes.

## Capabilities

### lead-item-card-uniformity

ADDED: a hovered lock badge's tooltip leaves with its anchor.

## Impact

`sdlc-tooltip.tsx` (`useSdlcTooltip` and its provider) and
`sdlc-tooltip.test.tsx`. `LockBadge` keeps its existing public API.
