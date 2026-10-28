# Design: Lead Form Save and Add Another

## Context

The Lead Report form supports item creation via two surfaces:

1. `ItemInlineEditor` in Lead Status Overview (spanned below the unit timeline), orchestrated by `useOverviewItemEditor` and `overview-item-submission.ts`.
2. `ItemEditDialog` (modal dialog, used e.g. for quick-add and slide/section item creation).

Both surfaces share underlying hooks: `useItemEditDialog`, `useItemEditSave`, and `useItemEditFormState`.
The baseline UX requires returning to the card or clicking `+` again after every save. Point 14 of TASK-766 / TASK-707 identifies batch item creation as a click-cost bottleneck.

## Goals / Non-Goals

**Goals:**

- Provide a clear, discoverable "Save and add another" button on item creation surfaces.
- Support `Ctrl+Shift+Enter` (and `Cmd+Shift+Enter`) keyboard shortcut.
- Validate inputs identically to standard Save.
- On save success, keep the editor mounted/opened for the same reporting unit/product and active week with cleared text fields (and remembered stage applied), focusing the description field.
- On save failure or validation rejection, keep input unchanged without losing draft data.
- Hide or disable "Save and add another" when editing an existing item (`mode === "edit"` or `item !== null`).

**Non-Goals:**

- Changing risk or decision dialogs (TASK-766 specifically targets Lead item form / overview batch entry).
- Bypassing or changing the server API draft save pipeline.
- Bulk multi-row table entry modes.

## Decisions

### 1. `onSaveAndAddAnother` callback in `useItemEditSave` and `ItemInlineEditor` / `ItemEditDialog`

- `useItemEditSave` handles both standard save (`handleSave`) and save-and-add-another (`handleSaveAndAddAnother`).
- Keyboard handler `handleKeyDown`:
  - `Enter + (ctrlKey || metaKey)`:
    - If `event.shiftKey` and `onSaveAndAddAnother` is provided: call `handleSaveAndAddAnother()`.
    - Else call `handleSave()`.
- The button is rendered in `InlineEditActions` (and `RecordDialogFooter` when `onSaveAndAddAnother` is passed) only when in create mode (`!item` or `isCreate`).

### 2. Overview Submission handling for Add-Another

- In `useOverviewItemEditor`, the `save` function receives the item payload and an optional `addAnother?: boolean` flag (or `saveAndAddAnother` handler).
- In `overview-item-save.ts` and `overview-item-submission.ts`:
  - When `addAnother` is true, the submission record stores an `addAnother: true` flag.
  - When the draft save is acknowledged (`overviewSubmissionIsAcknowledged`), instead of setting dialog to `null`, `setDialog` resets the dialog to a new create composer for the same target (`createOverviewComposerState(editor, target, null)`).
  - The new composer draft store starts empty for text/nextStep, but retains the target unit and week.
  - Description textarea receives focus (via `focusOnMount` or ref on the new instance).

### 3. Error Handling and Recovery

- If client validation fails, field errors are shown and the first invalid control is focused, matching normal save behavior.
- If server autosave fails (`editor.draft.autosave.state === "error"`), the error message is displayed and the current editor state remains intact so the lead can retry or edit.

## Risks / Trade-offs

- _Risk_: A rapid second submission while the first save is in flight.
  _Mitigation_: The editor's save actions are disabled while submission is in-flight (`saveDisabled`), matching standard save discipline.
- _Risk_: Focus loss when the composer resets.
  _Mitigation_: `ItemDescriptionField` uses `focusOnMount` on `RecordTextareaField`. When the dialog resets with a new key / fresh draftStore, the textarea mounts and gains focus automatically.
