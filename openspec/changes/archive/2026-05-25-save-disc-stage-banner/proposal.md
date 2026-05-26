# Save-disc icon + stage-warning banner

## Problem

Two rough edges in the lead report toolbar introduced visual noise and
information overload:

1. **Save button** — the autosave button rendered as a labelled pill ("Save
   now", "Saving…", "Saved"). Text labels are redundant alongside the
   header-level autosave badge, and the pill sat in the _middle_ of the
   toolbar's right group rather than at the far-right edge (WCAG tap-target
   parity with siblings FillFromButton / VersionHistoryNav / ArchiveToggle
   was also missing).

2. **Stage scope warning** — when a lead selects stages in RiskEditDialog or
   ItemEditDialog, a warning paragraph appeared _below_ the stage checkboxes
   and enumerated the selected stages by name ("Dev, Testing will show as
   Blocked"). The position (below the thing it describes) reduces
   scanability, and the enumeration is redundant because the checkbox row
   already shows which stages are ticked.

## Solution

- Convert `SaveNowButton` to icon-only (floppy-disc / spinner / check /
  alert-triangle) with `aria-label` / `title` carrying the accessible name.
  Move from `leadingExtras` (middle slot) to the tail of `trailingExtras`
  (far-right), with a vertical separator. Size is `--touch-target-min`
  (≈44×44) to match siblings.

- Hoist the stage-scope warning in `StageMultiSelect` from a bottom
  paragraph to an `aria-live="polite"` amber banner placed _above_ the
  checkbox row. Collapse enumeration to three cases: 0 selected → "All
  assigned stages…", 1 → "Stage X…", ≥2 → "Selected stages…".

## Non-goals

- Remove the autosave header badge (`Version N · HH:MM`) — kept as a
  separate widget for now; can be dropped in a follow-up if a single
  autosave-status source is preferred.
- Change the autosave timing, debounce, or save logic.
- Touch `RiskEditDialog`, `ItemEditDialog`, or `DecisionEditDialog` directly
  — `StageMultiSelect` is the single source; all consumers inherit the fix.
- Touch head-role surfaces — `ReportToolbar` is still available with
  `leadingExtras` prop intact (no consumers used it in head).

## Status

Shipped — 3 commits on `fix/PRJ-2/save-disc` (2026-05-25).
