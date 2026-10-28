# Tasks

## 1. Item Editor UI Components and Shortcuts

- [ ] 1.1 Add failing unit tests for `useItemEditSave` verifying `handleSaveAndAddAnother` and `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` shortcuts in create mode vs edit mode.
- [ ] 1.2 Implement `onSaveAndAddAnother` callback, `handleSaveAndAddAnother`, and `Ctrl+Shift+Enter` shortcut in `useItemEditSave` and `useItemEditDialog`.
- [ ] 1.3 Add failing tests for `ItemInlineEditor` and `ItemEditDialog` verifying the "Save and add another" button visibility, accessibility, and disabled states.
- [ ] 1.4 Update `InlineEditActions`, `ItemInlineEditor`, `RecordDialogFooter`, and `ItemEditDialog` to display "Save and add another" in create mode.

## 2. Overview Item Submission and Form Reset

- [ ] 2.1 Add failing integration tests for `useOverviewItemEditor` and `overview-item-submission.ts` covering success, reset to same unit/week, focus return, and retention on save error.
- [ ] 2.2 Wire `addAnother` flag in `overview-item-save.ts` and `overview-item-submission.ts` to reset the composer with fresh draft state and focus for the same unit/week on acknowledgment.
- [ ] 2.3 Verify error scenarios (validation failure and persistence failure) retain user input without closing or resetting the editor.

## 3. Verification and Gates

- [ ] 3.1 Run tests for modified components and verify RED -> GREEN transition.
- [ ] 3.2 Run repo gates: format:check, lint, typecheck, test, build, spec:check.
