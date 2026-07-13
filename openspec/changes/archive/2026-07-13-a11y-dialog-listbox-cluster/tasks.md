## 1. Shared primitive baseline

- [ ] 1.1 Read `apps/web/src/lib/use-dialog-focus.ts` and its test
      (`use-dialog-focus.test.tsx`); confirm it already covers Tab trap,
      Escape-to-close, and focus-restore-to-trigger, and needs no new option
      added to support the migrations below — each dialog keeps its own
      backdrop-click handler wired to the same `onClose`/`onCancel` callback
      the primitive uses for Escape
- [ ] 1.2 If the confirmation above surfaces a real gap (e.g. a dialog needs
      a close path the primitive doesn't support), extend
      `useDialogFocus` with the minimum option needed rather than working
      around it per-caller

## 2. Migrate ConfirmDeleteDialog

- [ ] 2.1 `apps/web/src/shared/ui/confirm-delete-dialog.tsx`: replace the
      hand-rolled `keydown` listener (Escape-only) and the manual
      `requestAnimationFrame` focus-on-open effect with `useDialogFocus`,
      passing the dialog surface's ref as `containerRef` and `onCancel` as
      `onClose`
- [ ] 2.2 Keep the existing backdrop `onClick={onCancel}` and the
      focused-Enter-confirms behavior; verify Tab from the destructive
      button now wraps to the Cancel button instead of leaving the dialog
- [ ] 2.3 Update/extend `confirm-delete-dialog`'s co-located test (create one
      if none exists) to assert Shift+Tab from the first focusable control
      wraps to the last, and focus returns to the trigger on close

## 3. Migrate UsersTab's delete-confirmation modal

- [ ] 3.1 `apps/web/src/features/admin/ui/users-tab.tsx` (delete modal at
      the current `593-627` range): add a `containerRef` to the modal
      surface and wire `useDialogFocus` with `onClose` set to
      `() => setDeleteTarget(null)`, closing the gap where this modal
      currently has no Escape handling, no backdrop dismiss, and no focus
      trap at all
- [ ] 3.2 Add a backdrop `onClick={() => setDeleteTarget(null)}` on the
      overlay div, matching `ConfirmDeleteDialog`'s convention
- [ ] 3.3 Extend `users-tab`'s test coverage to assert the delete modal
      closes on Escape and on backdrop click, and restores focus to the
      row's delete trigger

## 4. Migrate FillFromConfirmDialog

- [ ] 4.1 `apps/web/src/features/period/ui/fill-from-confirm-dialog.tsx`:
      add a `containerRef` to the dialog surface and wire `useDialogFocus`
      with `onClose` set to `onCancel`, closing the same gap (no Escape, no
      backdrop dismiss, no focus trap)
- [ ] 4.2 Add a backdrop `onClick={onCancel}` on the overlay div
- [ ] 4.3 Add or extend a co-located test asserting Escape and backdrop
      click both call `onCancel`, and focus restores to the trigger

## 5. Period listbox: adopt the shared primitive's close lifecycle + fix scroll

- [ ] 5.1 `apps/web/src/features/period/model/use-period-listbox-nav.ts`:
      the listbox is a combobox pattern — focus stays on the trigger button
      and the active option is tracked via `aria-activedescendant`, not real
      DOM focus — so only the primitive's Escape-to-close and
      focus-restore-to-trigger lifecycle applies here, not its
      focus-move-into-container or Tab-trap behavior (the panel has no
      focusable descendants for Tab to trap between). Replace the
      hand-rolled `Escape` branch in `handleListKeyDown` and the
      `closeAndRefocus` callback with `useDialogFocus`'s `onClose` handler,
      keeping the existing dual-ref outside-click listener as-is (outside
      the primitive's scope)
- [ ] 5.2 Add `scrollIntoView({ block: "nearest" })` (or equivalent) on the
      active option's element whenever `activeIdx` changes via
      `ArrowUp`/`ArrowDown`/`Home`/`End`, so the keyboard highlight never
      scrolls out of the visible panel
- [ ] 5.3 Extend `use-period-listbox-nav`'s test coverage (or the
      `PeriodNavigator` component test, whichever already exercises
      keyboard nav) to assert the active option scrolls into view on
      `ArrowDown` past the visible edge, and that Escape still closes and
      refocuses the trigger

## 6. QuickAddButton aria-haspopup fix

- [ ] 6.1 `apps/web/src/features/report-sections/ui/quick-add-button.tsx`:
      change the trigger's `aria-haspopup="menu"` to a value that matches
      the popup's actual `role="group"` markup (`aria-haspopup="true"`, or
      restructure the popup to a real `role="menu"` with `role="menuitem"`
      options if a true menu semantic is wanted instead) — pick one
      consistent pairing, not a mismatch
- [ ] 6.2 Update/add a test asserting the trigger's `aria-haspopup` value
      agrees with the popup's rendered role

## 7. AccordionSection aria-controls fix

- [ ] 7.1 `apps/web/src/shared/ui/report-shell/accordion-section.tsx`: give
      the collapsible panel a stable id (derive from `testId` or an
      existing prop) and add `aria-controls` referencing that id to both
      the header toggle button and the trailing icon-button toggle (the
      `actions ? <button aria-label=...> : null` branch), so each
      `aria-expanded` toggle is correctly associated with the panel it
      expands
- [ ] 7.2 Extend `accordion-section`'s test coverage to assert both toggle
      buttons carry `aria-controls` pointing at the panel's id

## 8. Spec delta

- [ ] 8.1 Add the new `dialog-listbox-a11y` capability under
      `openspec/specs/` with the requirements this change adds (Tab-trap
      adoption for the three confirmation dialogs, close-lifecycle adoption + scroll-into-view for the period listbox, ARIA-relationship
      correctness for quick-add and the accordion)

## 9. Gates and verification

- [ ] 9.1 `pnpm --filter @customreport/api db:generate`
- [ ] 9.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 9.3 Live-check each migrated surface with keyboard only: open
      ConfirmDeleteDialog on any lead delete action, Tab past the last
      button and confirm focus wraps instead of leaving the dialog; open
      UsersTab's delete modal and confirm Escape and backdrop click both
      close it; open FillFromConfirmDialog the same way; open the period
      listbox, ArrowDown past the visible edge and confirm the highlighted
      option scrolls into view; open QuickAddButton's popup with a screen
      reader (or the accessibility tree in devtools) and confirm
      `aria-haspopup` matches the announced role; expand/collapse an
      accordion section from both toggles and confirm `aria-controls`
      resolves to the panel
- [ ] 9.4 `openspec validate a11y-dialog-listbox-cluster --strict`
- [ ] 9.5 Adversarial review of the diff (two independent reviewers) before
      archiving
