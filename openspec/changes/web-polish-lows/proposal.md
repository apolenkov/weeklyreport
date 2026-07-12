## Why

Wave 3 / P3 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

Eleven small, unrelated react/correctness defects survived adversarial
verification across the lead-form, dialogs, period admin, dashboard, and
shared web utilities:

- `usePauseReason` invokes its `onPause` persist callback from inside a
  `useState` updater function — a side effect in a position React may invoke
  twice under Strict Mode, double-firing the mutation.
- `item-edit-dialog`'s invalid-field focus logic only ever targets the text
  field or an unrelated stage checkbox; a `pausedReason`-only validation
  error leaves focus on Save instead of the reason field.
- The lead-form header's autosave badge always renders on the green
  `--color-success` background, including the `"⚠ Save failed"` label — an
  error state visually reads as success.
- `ViewModeToggle`'s slides-mode `slidesHref` in the toolbar controls, and
  its edit-route fallback, both need to preserve the requested mode so a
  slides-mode entry doesn't silently reopen in edit mode.
- `SaveNowButton` only clears its `"Saved"` checkmark on a timer; a save
  that starts and fails inside that ~1.5s window still shows the stale
  checkmark instead of the error state.
- `alert-bar` keys its pending-lead list by display name, which collides
  for two leads sharing a name.
- `periods-tab-dialog`'s submit handler turns a cleared end-date or deadline
  into `undefined` (omitted from the payload) instead of an explicit
  `null`, so clearing an existing value is silently ignored by the server.
- `periods-action-icon-row`'s delete-button guard only checks
  `periodStatus === "published"`, while the server also rejects deletes on
  reopened periods — the client enables a delete the server will refuse.
- `use-cursor-pagination` always overwrites `enabled` in the built query
  options with `options.enabled`, clobbering a value the factory itself set
  when the caller passes no `options.enabled`.
- `web-vitals.ts`'s dynamic `import("web-vitals")` chain has no top-level
  `.catch`; a chunk-load failure becomes an unhandled promise rejection.
- `products-tab`'s `handleSave` has no blank-name guard, so a blank product
  name reaches `saveProjectMut.mutate`.

## What Changes

- `apps/web/src/hooks/use-pause-reason.ts`: move the `onPause?.(...)` call
  out of the `setPending` updater into `confirm`'s function body, called
  before `setPending(null)`.
- `apps/web/src/features/report-sections/ui/item-edit-dialog.tsx`: when the
  only invalid field is `pausedReason`, focus `#item-paused-reason` instead
  of the first stage checkbox.
- `apps/web/src/features/report-sections/ui/lead-form-header-actions.tsx`:
  give the autosave badge a destructive variant (border/bg/text) when
  `autosave.state === "error"`, instead of always rendering
  `bg-[var(--color-success)]`.
- `apps/web/src/features/report-sections/ui/lead-form-toolbar-controls.tsx`:
  make the edit-route `editHref` and the read-only-fallback route both
  carry the requested `?mode=slides` marker where the toggle is entered
  from slides mode, so the fallback round-trips the mode instead of
  defaulting to edit.
- `apps/web/src/shared/ui/report-shell/save-now-button.tsx`: clear
  `showSaved` synchronously whenever `state` transitions away from
  `"saved"` (not only via the revert timer), so an error mid-window
  replaces the stale checkmark immediately.
- `apps/web/src/features/dashboard/ui/alert-bar.tsx`: key the
  `pendingNames` list by `id` (or index, if no stable id is available on
  `pendingLeads`) instead of `name`.
- `apps/web/src/features/period/ui/periods-tab-dialog.tsx`: when
  `periodEnd`/`deadline` is edited and cleared, submit `null` explicitly
  instead of `undefined`, mirroring the existing `weekLabel` clear-semantics
  comment and pattern.
- `apps/web/src/features/period/ui/periods-action-icon-row.tsx`: extend the
  delete-button guard to also disable/suppress delete when the period is
  reopened, mirroring the full server-side rejection condition.
- `apps/web/src/lib/use-cursor-pagination.ts`: only override `enabled` in
  the built query options when the caller explicitly supplies
  `options.enabled`; otherwise keep whatever the factory set.
- `apps/web/src/lib/web-vitals.ts`: add a `.catch(() => undefined)` to the
  top-level `import("web-vitals").then(...)` chain.
- `apps/web/src/features/admin/ui/products-tab.tsx`: add a `canSave`
  derivation that requires a non-blank trimmed `formName`, and disable the
  Save button / guard `handleSave` on it.

Each fix is scoped to its own file and is independently reviewable; no
shared module is introduced and no cross-file coordination is required.
