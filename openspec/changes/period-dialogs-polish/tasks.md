## 1. Badge the real previous period, not filtered index 0

- [ ] 1.1 `apps/web/src/features/period/ui/fill-from-button.tsx`: confirm
      where the real previous-period id is already known (the value the
      main split-button fills) and pass it down as `previousPeriodId`
- [ ] 1.2 `apps/web/src/features/period/ui/fill-from-dropdown-panel.tsx`:
      accept `previousPeriodId` prop; change the "Previous" badge/highlight
      condition from `idx === 0` (filtered array) to `p.id ===
  previousPeriodId`
- [ ] 1.3 Confirm behavior when the true previous period is filtered out of
      the search results entirely — no period should show the "Previous"
      badge in that state

## 2. Reset search on every close path

- [ ] 2.1 `fill-from-dropdown-panel.tsx` / `fill-from-button.tsx`: identify
      every path that sets the dropdown closed (Escape, period selection,
      outside click, trigger toggle)
- [ ] 2.2 Add `setSearch("")` (or equivalent reset) alongside
      `setShowDropdown(false)` on each of those paths

## 3. Wire the shared focus-trap primitive into the pause-reason dialog

- [ ] 3.1 `apps/web/src/features/period/ui/pause-reason-dialog.tsx`: remove
      the hand-rolled Escape handler and manual autofocus
- [ ] 3.2 Wire `useDialogFocus({ open, onClose, containerRef })`
      (`apps/web/src/lib/use-dialog-focus.ts`), matching the pattern already
      used by `ConfirmDeleteDialog` / `FillFromConfirmDialog`
- [ ] 3.3 Update the dialog's docblock claim ("mirrors ConfirmDeleteDialog")
      to be true after the change, or correct it if it was previously
      aspirational

## 4. Tests

- [ ] 4.1 Dropdown test: search filters out the true previous period; assert
      no filtered-index-0 mislabel
- [ ] 4.2 Dropdown test: search persists across each close path is asserted
      to be FALSE — i.e. assert `search` resets on Escape, selection,
      outside click, and trigger toggle
- [ ] 4.3 `pause-reason-dialog.test.tsx`: add Tab-wrap and focus-restore
      assertions matching `dialog-listbox-a11y`'s existing pattern for
      `ConfirmDeleteDialog`

## 5. Spec delta

- [ ] 5.1 `dialog-listbox-a11y`: MODIFIED — extend "Hand-rolled confirmation
      dialogs MUST share one focus-trap/restore primitive" to explicitly
      list `PauseReasonDialog`
      (`apps/web/src/features/period/ui/pause-reason-dialog.tsx`) alongside
      `ConfirmDeleteDialog`, `UsersTab`'s inline modal, and
      `FillFromConfirmDialog`
- [ ] 5.2 A period-feature spec (find or create the right home during
      implementation, e.g. extend `period-lifecycle-ui` or a new
      `fill-from-dropdown` capability): ADD requirements for the
      identity-based "Previous" badge and the search-reset-on-close
      behavior

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 Manual/Playwright drive: keyboard-only pass through the
      pause-reason dialog (Tab-wrap, Escape, backdrop-click restore); mouse
      pass through the fill-from dropdown (search + previous-badge +
      reopen-clears-search)
- [ ] 6.4 `openspec validate period-dialogs-polish --strict`
