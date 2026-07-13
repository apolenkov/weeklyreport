## 1. `usePauseReason` — side effect out of the state updater

- [ ] 1.1 `apps/web/src/hooks/use-pause-reason.ts`: rewrite `confirm` so it
      reads `pending` directly, calls `onPause?.(pending.id, reason)` as a
      plain statement (not inside `setPending`'s updater function), then
      calls `setPending(null)`
- [ ] 1.2 Confirm no double-invocation under React Strict Mode (existing
      unit test or a new one asserting `onPause` is called exactly once per
      `confirm`)

## 2. `item-edit-dialog` — focus the actually-invalid field

- [ ] 2.1 `apps/web/src/features/report-sections/ui/item-edit-dialog.tsx`:
      add `id="item-paused-reason"` to the paused-reason input if it does
      not already carry a stable id
- [ ] 2.2 In `handleSave`'s invalid-focus branch, when `next.pausedReason`
      is set and `next.text` is not, focus
      `document.getElementById("item-paused-reason")` instead of the first
      stage checkbox
- [ ] 2.3 Keep the existing `next.text` → `#item-text` and
      stage-checkbox fallback branches for their respective error cases

## 3. Autosave badge — distinct error styling

- [ ] 3.1 `apps/web/src/features/report-sections/ui/lead-form-header-actions.tsx`:
      compute the badge's background/text classes from `autosave.state`
      (destructive variant on `"error"`) instead of the single hard-coded
      `bg-[var(--color-success)]` class, keeping the existing green for
      `"saving"` / `"pending"` / `"saved"` / default
- [ ] 3.2 Verify the `"⚠ Save failed"` label renders on the destructive
      background, not green

## 4. `ViewModeToggle` — slides-mode fallback preserves mode

- [ ] 4.1 `apps/web/src/features/report-sections/ui/lead-form-toolbar-controls.tsx`:
      audit the edit-route `editHref` and any read-only/foreign-deck
      fallback route used while in slides mode; append `?mode=slides` so
      re-entering from that fallback keeps the requested mode
- [ ] 4.2 Confirm the edit-mode `editHref` still carries no `mode` param
      (edit is the default) and the slides `slidesHref` is unaffected

## 5. `SaveNowButton` — clear stale "Saved" on state exit, not just on timer

- [ ] 5.1 `apps/web/src/shared/ui/report-shell/save-now-button.tsx`: add an
      effect (or extend the existing one) that sets `showSaved` to `false`
      synchronously whenever `state` is no longer `"saved"`, in addition to
      the existing timer-based revert
- [ ] 5.2 Confirm a save that fails while `showSaved` is still `true` (i.e.
      within the 1500ms revert window) flips the button to the error
      affordance immediately instead of waiting out the timer

## 6. `alert-bar` — stable list keys

- [ ] 6.1 `apps/web/src/features/dashboard/ui/alert-bar.tsx`: key the
      `pendingNames.map(...)` list by `pendingLeads`'s stable `id` field if
      one exists on the item shape; otherwise key by array index
- [ ] 6.2 Confirm two pending leads sharing a display name both render
      correctly (no missing/duplicated row)

## 7. `periods-tab-dialog` — explicit null on cleared end/deadline

- [ ] 7.1 `apps/web/src/features/period/ui/periods-tab-dialog.tsx`:
      in `handleSubmit`, when editing an existing period (`isEdit`) and
      `periodEnd`/`deadline` is cleared to an empty string, submit `null`
      for that field instead of `undefined`; keep `undefined` for the
      create-mode (`!isEdit`) empty case, mirroring the existing
      `weekLabel` clear-semantics comment
- [ ] 7.2 Confirm the create-mode payload is unchanged (still omits an
      unset end/deadline rather than sending `null`)

## 8. `periods-action-icon-row` — delete guard mirrors the server condition

- [ ] 8.1 Confirm the server's full delete-rejection condition (published
      OR reopened) by reading the delete mutation's guard on the api side
- [ ] 8.2 `apps/web/src/features/period/ui/periods-action-icon-row.tsx`:
      extend the delete-button's disabled/suppressed condition to also
      cover a reopened period, matching the server condition exactly
- [ ] 8.3 Update the button's `label` copy for the reopened case if it
      differs from the published-case copy

## 9. `use-cursor-pagination` — don't clobber a factory-set `enabled`

- [ ] 9.1 `apps/web/src/lib/use-cursor-pagination.ts`: only spread
      `enabled: options.enabled` into `queryOptions` when
      `options.enabled !== undefined`; otherwise let `built.enabled` (the
      factory's own value) pass through unmodified
- [ ] 9.2 Confirm a caller that omits `options.enabled` but whose factory
      sets `enabled: false` still gets a disabled query

## 10. `web-vitals` — handle dynamic-import rejection

- [ ] 10.1 `apps/web/src/lib/web-vitals.ts`: append `.catch(() => undefined)`
      to the top-level `import("web-vitals").then(...)` chain

## 11. `products-tab` — blank-name save guard

- [ ] 11.1 `apps/web/src/features/admin/ui/products-tab.tsx`: derive
      `canSave` as `formName.trim().length > 0`
- [ ] 11.2 Disable the Save button when `!canSave` (alongside the existing
      `isSaving` disable) and early-return from `handleSave` when
      `!canSave`

## 12. Spec delta

- [ ] 12.1 Add `openspec/changes/web-polish-lows/specs/web-polish-lows/spec.md`
      with one ADDED requirement per fix above

## 13. Gates and verification

- [ ] 13.1 `pnpm --filter @customreport/api db:generate`
- [ ] 13.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 13.3 Live-check in the running web app: pause an item via keyboard
      only (confirm single mutation, no Strict-Mode double-fire); trigger a
      `pausedReason`-only validation error and confirm focus lands on the
      reason field; force an autosave error and confirm the badge turns
      destructive; enter slides mode then trigger the edit-route fallback
      and confirm it stays in slides mode; clear an existing period
      end-date/deadline and confirm the server-side value is actually
      cleared; attempt to delete a reopened period and confirm the button
      is disabled; save a blank product name and confirm it is blocked
- [ ] 13.4 `openspec validate web-polish-lows --strict`
- [ ] 13.5 Adversarial review of the diff before archiving
