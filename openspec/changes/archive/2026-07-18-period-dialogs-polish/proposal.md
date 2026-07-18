## Why

BL-19 (P1), `docs/reviews/repo-excellence-review-2026-07-14.md`.

Three defects across the period fill-from and pause-reason UI:

- **(a) "Previous" mislabel under search.** `fill-from-dropdown-panel.tsx`
  keys its "Previous" badge/highlight to `idx === 0` of the
  search-filtered period list, not the real previous-period identity. A
  search query that filters out the true previous period causes another
  period to be mislabeled "Previous" (the main split-button action still
  fills the correct period — only the badge/highlight lies).
- **(b) Stale search on reopen.** The dropdown's `search` state is never
  reset on any close path (Escape, selection, outside click, the trigger
  button toggling closed), so reopening the dropdown starts pre-filtered by
  whatever query was left over from the previous session.
- **(c) Pause-reason dialog skips the shared focus-trap primitive.**
  `pause-reason-dialog.tsx` hand-rolls only Escape handling and initial
  autofocus, omitting `useDialogFocus`'s Tab focus-trap and focus-restore —
  despite its own docblock claiming to mirror `ConfirmDeleteDialog`, which
  DOES use the shared primitive (per `dialog-listbox-a11y`). A keyboard user
  can Tab out of the dialog to elements behind the backdrop.

## What Changes

- `fill-from-dropdown-panel.tsx`: accept `previousPeriodId` as an explicit
  prop (passed down from `fill-from-button.tsx`, which already knows the
  real previous period since the main split-button fills it correctly) and
  badge/highlight by `p.id === previousPeriodId`, not by filtered-array
  index.
- `fill-from-dropdown-panel.tsx` / `fill-from-button.tsx`: clear `search`
  state on every close path — Escape, selecting a period, outside click,
  and the trigger toggling closed — alongside `setShowDropdown(false)`.
- `pause-reason-dialog.tsx`: replace the hand-rolled Escape+autofocus with
  `useDialogFocus({ open, onClose, containerRef })`
  (`apps/web/src/lib/use-dialog-focus.ts`), matching every other hand-rolled
  dialog already governed by the `dialog-listbox-a11y` spec
  (`ConfirmDeleteDialog`, `UsersTab`'s inline delete modal,
  `FillFromConfirmDialog`).

## Claim disposition

| Sub-claim                                               | Disposition | Notes                                                                                                                        |
| ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| (a) "Previous" badge mislabels on search-filtered index | Confirmed   | Badge keyed to filtered-array `idx === 0`, not period identity.                                                              |
| (b) search state not reset on close                     | Confirmed   | No reset call found on any close path in current source.                                                                     |
| (c) pause-reason dialog missing Tab focus-trap/restore  | Confirmed   | Only Escape + autofocus implemented; `useDialogFocus` not wired despite docblock claiming parity with `ConfirmDeleteDialog`. |

No refuted sub-claims — no preservation-test task required.

## Non-goals

- No change to the main split-button's fill action itself — it already
  fills the correct (real) previous period; only the dropdown's
  badge/highlight and search-reset are in scope.
- No change to `useDialogFocus`'s own implementation
  (`apps/web/src/lib/use-dialog-focus.ts`) — `pause-reason-dialog.tsx` is
  brought into conformance with the existing primitive, not the other way
  around.
- No visual redesign of the pause-reason dialog beyond wiring the focus-trap
  primitive.

## File manifest

- `apps/web/src/features/period/ui/fill-from-dropdown-panel.tsx` (source, verified present, 118 lines)
- `apps/web/src/features/period/ui/fill-from-dropdown-panel.test.tsx` (test — verified ABSENT via `find`; create new, or add cases to `fill-from-button.test.tsx` if the dropdown is only reachable/testable through the button in practice)
- `apps/web/src/features/period/ui/fill-from-button.tsx` (source, verified present, 209 lines)
- `apps/web/src/features/period/ui/fill-from-button.test.tsx` (test, verified present)
- `apps/web/src/features/period/ui/pause-reason-dialog.tsx` (source, verified present, 123 lines)
- `apps/web/src/features/period/ui/pause-reason-dialog.test.tsx` (test, verified present)
- `apps/web/src/lib/use-dialog-focus.ts` (source, read-only reference — the primitive being adopted)

## Verification

- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- Unit tests (jsdom):
  1. Render the dropdown with a search query that filters out the true
     previous period; assert the "Previous" badge/highlight is NOT applied
     to `idx === 0` of the filtered list, and IS applied to the period
     matching `previousPeriodId` if it's still in the filtered results (or
     to neither, if filtered out — assert it never mislabels a
     non-previous period).
  2. Open the dropdown, type a search query, close it (each close path:
     Escape, select, outside click), reopen — assert `search` is empty on
     reopen, for every close path.
  3. `pause-reason-dialog.test.tsx`: assert Tab from the last focusable
     control wraps to the first (focus-trap), and assert focus returns to
     the triggering control on close — the same assertions
     `dialog-listbox-a11y`'s existing scenarios use for `ConfirmDeleteDialog`
     / `FillFromConfirmDialog`.
- Popup/focus/keyboard-trap behavior additionally requires a live browser
  drive step (jsdom's Tab-order simulation is not fully reliable for
  focus-trap wrap behavior):
  1. Open the pause-reason dialog with a real keyboard, Tab through all
     controls, confirm focus wraps and never lands behind the backdrop.
  2. Confirm Escape and backdrop click both restore focus to the trigger.
  3. Confirm the fill-from dropdown's "Previous" badge and search-reset
     behave correctly via manual keyboard+mouse interaction, matching the
     unit-test assertions above.

## Sequencing

Independent — touches only `period` feature UI files and adopts an existing
shared primitive (`useDialogFocus`) that other dialogs already use; no
dependency on any other change in this batch.
