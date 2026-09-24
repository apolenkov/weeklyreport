## Context

Status Overview is an Operate surface with a read-first idle state. The shipped
paper palette, compact spacing, unit summary, and Previous/Current/Next grid are
accepted visual truth. Current editors are mounted through one
`StatusOverviewEditorSlot`, identified by unit, source, record ID and stable ID.
The slot may represent an item edit, a create composer, or the existing
resolve/restore content.

## Decisions

- Treat editor expansion as unit-local presentation derived from the existing
  slot. Do not add another editor state or infer matches from visible text.
- In a linked row, match the slot through the existing stable-ID-first,
  record-ID fallback plus source rule. Keep all three cells visible and mount
  the matched editor once below them across the timeline width.
- In independent lists, keep source context visible and mount the matching
  editor below the source row. Lists remain independent arrays; no
  position-based pairing is introduced.
- In the footer, a create slot spans the timeline and hides the other footer
  lanes. Unit identity remains visible at the 80rem topology.
- Keep resolve/restore content inside the same editor-slot contract, so it
  receives identical layout without a separate modal or path.
- Keep preview copy readable and use the complete item editor for changes,
  preserving its accessible name, focus-return attributes, disclosure and
  metadata. Read-only rows never expose a write action.
- Keep primary move and status actions visible and direct. Do not use a dropdown
  for a single available command.

## Invariants

- Existing stable ID, record ID, source, and unit scoping determine the one
  mounted editor.
- Unmatched lineage rows and other reporting units remain rendered.
- Closing the editor restores the identical idle topology and focus target.
- Current and Next collections remain independent and are never paired by list
  index.
- All existing canonical draft, autosave, recovery, create acknowledgement,
  outcome, and lifecycle behavior remains unchanged.

## Responsive behavior

At `md+`, a matched editor receives the full three-column timeline width below
the still-visible Previous, Current, and Next cells. At 80rem, the unit summary
remains the first column and the expanded editor uses the other three columns.
Mobile behavior is outside this change's acceptance scope.

Native browser acceptance at 1024, 1279, 1280 and 1728 CSS pixels remains a
separate acceptance task owned by the primary lane. Native 200% zoom is excluded
by the preserved September 9 user acceptance-scope update; ordinary desktop
layout and keyboard/focus requirements remain.
