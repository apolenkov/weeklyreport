# Tasks

## 1. Item Editor UI Components and Shortcuts

- [x] 1.1 Add failing unit tests for `useItemEditSave` verifying `handleSaveAndAddAnother` and `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` shortcuts in create mode vs edit mode.
- [x] 1.2 Implement `onSaveAndAddAnother` callback, `handleSaveAndAddAnother`, and `Ctrl+Shift+Enter` shortcut in `useItemEditSave` and `useItemEditDialog`.
- [x] 1.3 Add failing tests for `ItemInlineEditor` and `ItemEditDialog` verifying the "Save and add another" button visibility, accessibility, and disabled states.
- [x] 1.4 Update `InlineEditActions`, `ItemInlineEditor`, `RecordDialogFooter`, and `ItemEditDialog` to display "Save and add another" in create mode.

## 2. Overview Item Submission and Form Reset

- [x] 2.1 Add failing integration tests for `useOverviewItemEditor` and `overview-item-submission.ts` covering success, reset to same unit/week, and focus return. Done in `lead-status-overview.test.tsx` ("Save and add another clears the composer fields and returns focus to the description"); it failed before the composer remount fix. Retention on save error is open in 2.3.
- [x] 2.2 Wire `addAnother` flag in `overview-item-save.ts` and `overview-item-submission.ts` to reset the composer with fresh draft state and focus for the same unit/week on acknowledgment. The reset advances `seq`, and the Overview editor keys on it so it remounts with the fresh draft store.
- [ ] 2.3 Verify error scenarios (validation failure and persistence failure) retain user input without closing or resetting the editor. Covered by unit tests in `lead-status-overview.test.tsx` ("validation failure retains input" types an over-limit description; "persistence failure retains input"). Browser verification is open: no stand was available for this run.

## 3. Verification and Gates

- [x] 3.1 Run tests for modified components and verify RED -> GREEN transition.
- [ ] 3.2 Run repo gates: format:check, lint, typecheck, test, build, spec:check.
