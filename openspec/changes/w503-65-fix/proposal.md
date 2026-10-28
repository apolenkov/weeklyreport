# Proposal

## Why

Three findings from TASK-503 wave 10 (TASK-503.65, frozen clauses C4921, C5001,
C5007) show the item UI losing or misreporting state:

- C4921: when an item's outcome history is non-empty but does not contain the
  event that its Won't do resolution references, the resolution actor and
  timestamp are never shown.
- C5001: every mounted inline item editor installs the unload and navigation
  guard, so a pristine editor prompts the user on leave.
- C5007: the priority rank select parses partial input (`"2foo"` becomes `2`)
  and can propagate `NaN`.

## What Changes

- Render the Won't do resolution line whenever the resolution exists and no
  outcome history event carries its `eventId`.
- Enable the inline editor unload guard only while the editor has unsaved
  changes (the same dirty definition the discard guard uses).
- Normalize the priority rank select value to a whole integer or `null`; any
  other text becomes `null` before it reaches the draft.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `unified-report-authoring`: Won't do resolution visibility and inline editor
  navigation warning.
- `record-dialog-layout`: priority rank selection accepts only whole ranks.

## Impact

- `apps/web/src/features/report-pages/ui/product/accordion-rows.tsx`
- `apps/web/src/features/report-sections/ui/item-inline-editor.tsx`,
  `use-item-edit-dialog.ts`, `use-item-edit-form-state.ts`
- `apps/web/src/features/report-sections/ui/item-edit-dialog-fields.tsx`
- Colocated tests for each of the three files.

## Non-goals

- No change to the draft store, autosave, or the discard dialog behavior.
- No live producer or native browser prompt verification; the frozen clauses
  record that evidence separately (TASK-503.65 notes).
