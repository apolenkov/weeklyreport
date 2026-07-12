## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

The repo already has one shared focus-management primitive,
`useDialogFocus` (`apps/web/src/lib/use-dialog-focus.ts`), which traps Tab,
closes on Escape, and restores focus to the trigger on close. Several
hand-rolled dialogs and one custom listbox never adopted it and instead
re-implement a subset of the same behavior, inconsistently:

- `ConfirmDeleteDialog` (`apps/web/src/shared/ui/confirm-delete-dialog.tsx`,
  used by 11 delete surfaces) hand-rolls Escape-only handling with no Tab
  trap and no focus restore, so Shift+Tab from the destructive button walks
  focus behind the backdrop.
- `UsersTab`'s inline delete-confirmation modal
  (`apps/web/src/features/admin/ui/users-tab.tsx:593-627`) and
  `FillFromConfirmDialog`
  (`apps/web/src/features/period/ui/fill-from-confirm-dialog.tsx:26`) have no
  Escape handling, no backdrop dismiss, and no focus trap at all, unlike
  their sibling dialogs.
- `QuickAddButton`'s popup
  (`apps/web/src/features/report-sections/ui/quick-add-button.tsx:78`)
  advertises `aria-haspopup="menu"` on its trigger while the popup itself is
  a `role="group"`, not a menu — the two roles don't agree, so a screen
  reader announces the wrong interaction model.
- `AccordionSection`
  (`apps/web/src/shared/ui/report-shell/accordion-section.tsx:54-99`) renders
  two separate `aria-expanded` toggles for the same panel with neither
  wired to `aria-controls`, so assistive tech cannot associate either toggle
  with the panel it expands.
- The period listbox's keyboard navigation
  (`apps/web/src/features/period/model/use-period-listbox-nav.ts:116-127`)
  moves `activeIdx` on Arrow/Home/End but never scrolls the newly active
  option into view, so the keyboard highlight can scroll out of the visible
  list with no visual indication of where it went.

None of this breaks any user-facing function — it is a cluster of
keyboard/screen-reader gaps against the repo's own established
conventions, all traceable to one root cause (dialogs built before or
without the shared primitive existed).

## What Changes

- Confirm `useDialogFocus` already covers everything the three
  confirmation dialogs need (Tab trap, Escape, focus restore) and needs no
  new capability added to it; each dialog keeps its own backdrop-click
  handler wired to the same close callback the primitive uses for Escape.
- Migrate `ConfirmDeleteDialog` to `useDialogFocus`, replacing its
  hand-rolled Escape-only `keydown` listener and manual `requestAnimationFrame`
  focus call.
- Migrate `UsersTab`'s inline delete-confirmation modal to `useDialogFocus`,
  adding the Escape/backdrop-dismiss/focus-trap behavior it currently lacks
  entirely.
- Migrate `FillFromConfirmDialog` to `useDialogFocus`, same gap as above.
- Migrate the period listbox (`use-period-listbox-nav.ts`) to
  `useDialogFocus` for its open/close and Escape lifecycle, and add
  `scrollIntoView({ block: "nearest" })` (or equivalent) on every `activeIdx`
  change driven by keyboard navigation so the highlighted option never
  scrolls out of view.
- Fix `QuickAddButton`'s `aria-haspopup` value so it matches the popup's
  actual `role="group"` markup instead of claiming `"menu"`.
- Add `aria-controls` (pointing at a stable id on the collapsible panel) to
  both `AccordionSection` toggle buttons so each `aria-expanded` toggle is
  correctly associated with the panel it controls.
- Each migration lands as its own task (see Tasks) so the shared primitive
  is adopted deliberately per surface rather than force-fit onto a control
  it doesn't cleanly cover.

## Capabilities

### New Capabilities

- `dialog-listbox-a11y`: shared focus-trap/dismiss primitive adoption
  across the hand-rolled confirmation dialogs and the period listbox, plus
  correct ARIA relationships for the quick-add popup and the accordion
  toggles.

### Modified Capabilities

(none — `admin-dialog-focus-management` already governs the four admin
CRUD add/edit dialogs and is out of scope; `UsersTab`'s delete
confirmation is a distinct surface covered by the new capability instead)

## Impact

- `apps/web/src/shared/ui/confirm-delete-dialog.tsx`
- `apps/web/src/features/admin/ui/users-tab.tsx`
- `apps/web/src/features/period/ui/fill-from-confirm-dialog.tsx`
- `apps/web/src/features/report-sections/ui/quick-add-button.tsx`
- `apps/web/src/shared/ui/report-shell/accordion-section.tsx`
- `apps/web/src/features/period/model/use-period-listbox-nav.ts`

Non-goals: no change to `useDialogFocus` itself (it already covers what
every migration needs); no change to the four admin CRUD dialogs already
governed by `admin-dialog-focus-management`; no visual/styling changes —
keyboard and ARIA behavior only.
