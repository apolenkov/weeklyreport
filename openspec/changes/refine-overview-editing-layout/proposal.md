## Why

The compact Lead Status Overview reads clearly while idle, but a complete item
editor currently replaces one narrow timeline preview. At desktop widths that
can constrain the editor to roughly one quarter of the report card. Additional
Current and Next items are independent lists, yet their adjacent presentation
can imply a relationship the data does not contain. The update text also acts
as the complete edit target, which mixes reading with operation.

## What Changes

- Keep the existing idle unit and three-lane timeline layout.
- Keep the matching unit's Previous, Current, and Next lanes visible while its
  record editor opens below them across the full timeline width.
- Give create and existing resolve/restore editors the same timeline width.
- Keep update copy readable and use the existing complete item editor for
  changes.
- Label independent Current and Next update lists without pairing them by index
  or aligning their actions as shared lineage.

## Non-goals

- No new write, autosave, identity, recovery, persistence, or lifecycle path.
- No drag-and-drop, new modal, icon action set, design system, or report-wide
  visual redesign.
- No change to linked lineage, idle row topology or unit ordering.

## Capabilities

### Modified Capabilities

- `lead-status-overview`
