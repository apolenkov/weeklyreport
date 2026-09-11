## Why

The compact Lead Status Overview reads clearly while idle, but a complete item
editor currently replaces one narrow timeline preview. At desktop widths that
can constrain the editor to roughly one quarter of the report card. Additional
Current and Next items are independent lists, yet their adjacent presentation
can imply a relationship the data does not contain. The update text also acts
as the complete edit target, which mixes reading with operation.

## What Changes

- Keep the existing idle unit and three-lane timeline layout.
- Let only the matching unit and record editor occupy the full timeline width;
  temporarily hide that unit's sibling lanes until the editor closes.
- Give create and existing resolve/restore editors the same timeline width.
- Render update copy as readable text with a separate visible `Edit` action.
- Label independent Current and Next update lists without pairing them by index
  or aligning their actions as shared lineage.

## Non-goals

- No new write, autosave, identity, recovery, persistence, or lifecycle path.
- No drag-and-drop, new modal, icon action set, design system, or report-wide
  visual redesign.
- No change to linked lineage, idle row topology, unit ordering, or retained
  draft behavior.

## Capabilities

### Modified Capabilities

- `lead-status-overview`
