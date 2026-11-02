## Why

The owner reviewed the Lead Report Overview on the stand (2026-11-02) and asked for
a calmer card (`~/work/handoffs/task-825/owner-request-card-ux-2026-11-02.md`):

- creating or editing an update expands an editor inside the grid, so the
  schema jumps; every add should open in a pop-up instead;
- drag and drop did not turn out well and should go;
- on hover the card should show all its actions at once — status, week move,
  stage label, edit — with at most one menu level; the status icon already opens
  the status menu, so a separate "Update status" entry is redundant;
- the `+` at the bottom of each cell is not needed; the unit header `+` is.

## What Changes

- **Dialog editor.** Create and edit open the canonical item editor in a modal
  dialog over the Overview. The grid never changes height while editing.
- **No drag and drop.** Remove the drag handle, draggable cards and drop
  targets; week moves stay on the move icon and `Alt+Arrow`.
- **Flat hover cluster.** Revealed on hover, focus within, and always on touch:
  week move, stage label, edit (pencil), plus the existing Plan/Restore recovery
  icons. No `More actions` overflow menu.
- **Status menu holds outcomes.** The status icon menu keeps the progress
  statuses and gains the terminal outcome entry formerly under `Update status`;
  choosing it opens the existing resolve flow. One menu level.
- **Stage label on the card.** The stage badge (or a stage icon when none is
  set) opens a one-level popover of the unit's owned stages; toggling a stage
  saves through the canonical draft path. Activities have no stages.
- **No cell `+`.** Row/cell creation buttons are removed. The unit header `+`
  (`Add item to <unit>`) remains, also on mobile and for empty units; the
  dialog's week choice selects Current or Next. The mobile per-week header
  controls go.
- **Comments stay** as a row icon; Previous verdict controls keep their own menu.

## Capabilities

### Modified Capabilities

- `lead-status-overview-actions`: card actions, editor placement, creation entry points.
- `lead-overview-week-moves`: drag and drop removed; moves by icon and keyboard.
- `lead-status-overview`: empty cells no longer offer creation.
- `report-toolbar-layout`: creation entry points named without contextual cells.

## Impact

`apps/web/src/features/report-sections/ui/status-overview-*` (card, chip,
overflow, lineage row, timeline footer), `apps/web/src/features/report-pages/ui/lead/shell/`
(editor slot, focus return, move wiring). Removes the `@dnd-kit` usage from the
Overview if no other owner uses it.
