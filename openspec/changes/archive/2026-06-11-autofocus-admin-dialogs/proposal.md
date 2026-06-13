## Why

An admin who opens any of the four admin CRUD dialogs (periods, users,
products, groups) by keyboard lands with focus still on `<body>`, not inside
the dialog — so the next Tab walks the page behind the modal instead of the
form. This was logged as a non-blocking follow-up during the a11y verification
of the recommended-ruleset flip: `openspec/changes/archive/2026-06-10-verify-
a11y-recommended-flip/tasks.md:162` observes the admin dialogs "do NOT move
initial focus inside on open — `document.activeElement` stays `<body>`" and
recommends a small autofocus follow-up. The lead-surface dialogs already focus
on open, so the admin surface is the weaker, inconsistent half.

## What Changes

- Each admin CRUD dialog moves keyboard focus to its first meaningful control
  on open, matching the lead-dialog pattern that already focuses an interior
  control (the lead item dialog focuses its Description textarea via `autoFocus`
  at `apps/web/src/components/lead/item-edit-dialog.tsx:258`).
- On close (Escape, Cancel, overlay click, or successful save), each admin
  dialog returns focus to the control that opened it, so keyboard position is
  not lost back to `<body>`. This restore-on-close half is NEW — no dialog in
  the repo currently saves and restores the trigger element; the lead dialogs
  focus on open but never restore (`confirm-delete-dialog.tsx:71-80` focuses,
  with no matching restore).
- Regression tests assert focus-on-open lands inside each admin dialog and that
  focus returns to the trigger on close.

## Capabilities

### New Capabilities

- `admin-dialog-focus-management`: the durable property that admin CRUD dialogs
  move focus inside on open and restore focus to the trigger on close.

### Modified Capabilities

<!-- None. The existing a11y-regression-coverage capability is scoped strictly
to the recommended-ruleset flip delta (commit c4610797) and explicitly logs
admin-dialog focus-on-open as OUTSIDE that delta
(openspec/specs/a11y-regression-coverage/spec.md Purpose + the tasks.md:162
observation). Adding NEW focus behavior there would broaden its purpose beyond
"keep the flip's a11y behavior regression-covered". -->

## Impact

- `apps/web/src/components/admin/periods-tab-dialog.tsx`
- `apps/web/src/components/admin/users-tab.tsx`
- `apps/web/src/components/admin/products-tab.tsx`
- `apps/web/src/components/admin/groups-tab.tsx`
- Co-located `*.test.tsx` for each.
- No backend, schema, dependency, or color-token change.
