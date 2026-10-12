# Proposal

## Why

C4696: while the session is unresolved the History toolbar renders a bare
`min-h-[44px]` placeholder, but the resolved toolbar is a bordered, padded,
wrapping frame of at least 44 + 24 + 2 px with a search slot and an archive
toggle. When the role resolves, the toolbar and the History panel below it jump.
The defect follows from the source arithmetic; no guessed height is involved.

## What Changes

- Before the role is known the toolbar renders the resolved frame itself, made
  `invisible`, `aria-hidden` and `inert`: the same padding, border, search slot
  (`min-h-[var(--touch-target-min)] min-w-[220px] flex-1`) and archive toggle.
  No role-scoped search renders.
- The reserve mirrors the resolved DOM instead of a measured constant, so its
  height and narrow-width wrap match the loaded toolbar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `loading-layout-stability`: History toolbar geometry while the session loads.

## Impact

`report-history-toolbar.tsx` and a colocated test. This supersedes the toolbar
hold in `d37-d37-f19-web-recovery-contracts` (proposal Impact, design Open
Questions): the coordinator released it on 2026-10-13, and f19 now points here.

## Non-goals

- Native measurement and CLS acceptance are not claimed by code or by jsdom; they
  are listed in the tasks for the WR lane.
- A resolved archive count that flips the toolbar's wrap state at an
  intermediate width (about 440-500 px) is outside the guarantee.
