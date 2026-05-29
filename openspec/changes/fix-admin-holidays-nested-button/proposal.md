# Fix admin settings "Holidays" coming-soon nested-button hydration error

## Why

UAT sweep (Wave 1, 2026-05-29) of `/admin?tab=settings` under the admin role
surfaced 2 React console errors:

```
In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.
<button> cannot contain a nested <button>.
```

Root cause: `HolidaysComingSoonControl` (`apps/web/src/components/admin/settings-tab.tsx`)
renders a `<button>` as the coming-soon control, and it is mounted INSIDE
`<TabsTrigger value="holidays">`, which Radix renders as its own `<button>`.
Nested interactive buttons are invalid HTML and trigger a hydration error.

Pre-existing on `main` (not a regression from the Wave-3 dep/quality work); the
UAT sweep is what made it visible. It is the only console error found across all
four roles — head/lead/viewer were clean.

Secondary: the control's `TODO(holidays-activation)` comment points at
`.planning/todos/pending/2026-05-21-holidays-calendar.md`, but `.planning/` has
been removed — the reference is now dangling and should be repointed or dropped.

## What Changes

- Make the holidays coming-soon control a non-interactive element so it is not a
  `<button>` nested in the `TabsTrigger` button. The control is already inert
  (`aria-disabled="true"`, `cursor-default`); replace the inner `<button>` with a
  `<span>` (carrying the same `aria-label`/`title`/`data-testid`), or render the
  `TabsTrigger` with `asChild`. Keep the ComingSoonBadge tooltip behavior and the
  deferred-feature pattern intact (per CLAUDE.md ComingSoon convention).
- Update the dangling `.planning/...` TODO reference.

## Impact

- `apps/web/src/components/admin/settings-tab.tsx` (single file).
- No behavior change for users (control stays inert/coming-soon); removes the
  hydration error and restores the "0 console errors per role" UAT bar.
- Verify with the existing admin settings tests + a Wave-1-style re-sweep of the
  admin role.
