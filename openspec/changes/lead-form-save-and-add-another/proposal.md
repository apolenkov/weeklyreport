# Proposal: Lead Form Save and Add Another

## Why

In the Lead Report form (both Overview inline item editor and the form quick-add dialog), entering a batch of items requires repeatedly opening the composer/dialog from scratch for every single item. As measured in the baseline click audit (TASK-707 / TASK-766, point 14), entering 5 items requires 5 separate open actions and 5 saves. Providing a "Save and add another" action (via button and `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`) streamlines rapid batch entry by persisting the item through the canonical draft-save pipeline and immediately keeping an empty editor open for the same unit/week/parent, with focus set to the primary description field.

## What Changes

- Add a "Save and add another" secondary action button to the item editor dialog and the Overview inline item editor when creating a new item (`mode === "create"` / `item === null`).
- Support keyboard shortcut `Ctrl+Shift+Enter` and `Cmd+Shift+Enter` to trigger "Save and add another" in create mode.
- In both Overview inline editor and Lead form item dialog:
  - When "Save and add another" is triggered, validate and submit the item through the canonical draft save path exactly as Save does.
  - Upon successful save, immediately reset/open an empty editor for the same reporting unit/product/activity and week, with focus returned to the first field (Description).
  - If saving fails or client validation fails, keep the current input intact with error feedback displayed; do not clear the editor or lose typed data.
- In edit mode (`mode === "edit"` / existing item), "Save and add another" is not displayed or active (only standard Save / Cancel / Delete applies).

## Capabilities

### Modified Capabilities

- `lead-status-overview-actions`: Support "Save and add another" action (button and Ctrl+Shift+Enter shortcut) in the Lead Overview item composer to enable continuous batch item entry.

## Impact

- `apps/web/src/features/report-sections/ui/`: `item-inline-editor.tsx`, `use-item-edit-save.ts`, `use-item-edit-dialog.ts`, `item-edit-dialog.tsx`, `record-dialog-footer.tsx`.
- `apps/web/src/features/report-pages/ui/lead/`: `use-overview-item-editor.tsx`, `overview-item-save.ts`, `overview-item-submission.ts`, `lead-form-dialogs.tsx`.
- Colocated unit and integration tests.
