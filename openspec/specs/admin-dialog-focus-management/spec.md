## Purpose

Admin CRUD dialogs must manage keyboard focus on open and close, so that keyboard
users can interact with the dialog form without manually navigating back into it,
and keyboard position is not lost to `<body>` after close. The four hand-rolled
admin overlays — users, products, groups, and periods create — are governed by
this spec. The lead-surface dialogs focus on open but do not restore on close;
this spec exclusively covers the admin surface.

## Requirements

### Requirement: Admin CRUD dialogs MUST move focus inside on open

Each admin CRUD dialog MUST move keyboard focus to its first meaningful form
control when it opens, rather than leaving `document.activeElement` on `<body>`.
This governs the four hand-rolled admin overlays: the users dialog
(`apps/web/src/features/admin/ui/users-tab.tsx`, first control `id="user-name"`),
the products dialog (`apps/web/src/features/admin/ui/products-tab.tsx`, first
control `id="product-name"`), the groups dialog
(`apps/web/src/features/admin/ui/groups-tab.tsx`, first control
`id="group-name"`), and the periods create dialog
(`apps/web/src/features/period/ui/periods-tab-dialog.tsx`, first control
`id="period-start"`). The behavior applies in both add and edit modes where a
dialog serves both.

#### Scenario: focus lands on the first control when an admin dialog opens

- **WHEN** an admin opens the users, products, groups, or periods CRUD dialog
- **THEN** keyboard focus is on that dialog's first meaningful form control
- **AND** `document.activeElement` is no longer `<body>`

#### Scenario: a regression test asserts focus-on-open per admin dialog

- **WHEN** the co-located test for each admin dialog runs
- **THEN** it asserts the first control receives focus on open
- **AND** a future edit that drops the focus-on-open wiring fails the test

### Requirement: Admin CRUD dialogs MUST restore focus to the trigger on close

Each admin CRUD dialog MUST return keyboard focus to the control that opened it
when it closes, on every close path — Escape, the Cancel button, an overlay
click, and a successful save. The dialog captures the previously focused element
on open and restores focus to it on the transition back to closed, so keyboard
position is not lost back to `<body>`. The opening triggers are the Add buttons
and the per-row Edit buttons in `users-tab.tsx`, `products-tab.tsx`,
`groups-tab.tsx`, and the create-period button in `periods-tab.tsx`.

#### Scenario: focus returns to the trigger when an admin dialog closes

- **WHEN** an open admin CRUD dialog closes via Escape, Cancel, overlay click,
  or a successful save
- **THEN** keyboard focus returns to the trigger control that opened the dialog
- **AND** focus is not left on `<body>`

#### Scenario: a regression test asserts restore-on-close per admin dialog

- **WHEN** the co-located test for each admin dialog runs
- **THEN** it opens the dialog from a trigger, closes it, and asserts focus is
  back on that trigger
- **AND** a future edit that drops the restore-on-close wiring fails the test
