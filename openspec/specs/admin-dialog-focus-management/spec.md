## Purpose

Admin CRUD dialogs must manage keyboard focus on open and close, so that keyboard
users can interact with the dialog form without manually navigating back into it,
and keyboard position is not lost to `<body>` after close. This spec governs the
five hand-rolled admin overlays: users, products, activities, groups, and periods
create. The lead-surface dialogs focus on open but do not restore on close; this
spec exclusively covers the admin surface.

## Requirements

### Requirement: Admin CRUD dialogs MUST move focus inside on open

Each admin CRUD dialog MUST move keyboard focus to its first meaningful form
control when it opens, rather than leaving `document.activeElement` on `<body>`.
This governs the five hand-rolled admin overlays: the users dialog
(`apps/web/src/features/admin/ui/users-tab.tsx`, first control
`id="user-last-name"`),
the products dialog (`apps/web/src/features/admin/ui/products-tab.tsx`, first
control `id="product-name"`), the activities dialog
(`apps/web/src/features/admin/ui/activities-tab.tsx`, first control
`id="activity-name"`), the groups dialog
(`apps/web/src/features/admin/ui/groups-tab.tsx`, first control
`id="group-name"`), and the periods create dialog
(`apps/web/src/features/period/ui/periods-tab-dialog.tsx`, first control
`id="period-start"`). The behavior applies in both add and edit modes where a
dialog serves both.

#### Scenario: focus lands on the first control when an admin dialog opens

- **WHEN** an admin opens the users, products, activities, groups, or periods
  CRUD dialog
- **THEN** keyboard focus is on that dialog's first meaningful form control
- **AND** `document.activeElement` is no longer `<body>`

#### Scenario: a regression test asserts focus-on-open per admin dialog

- **WHEN** the co-located test for each admin dialog runs
- **THEN** it asserts the first control receives focus on open
- **AND** an edit that drops the focus-on-open wiring fails the test

### Requirement: Admin CRUD dialogs MUST restore focus to the trigger on close

Each admin CRUD dialog MUST return keyboard focus to the control that opened it
when it closes, on every close path — Escape, the Cancel button, an overlay
click, and a successful save. The dialog captures the previously focused element
on open and restores focus to it on the transition back to closed, so keyboard
position is not lost back to `<body>`. The opening triggers are the Add buttons
and the per-row Edit buttons in `users-tab.tsx`, `products-tab.tsx`,
`activities-tab.tsx`, `groups-tab.tsx`, and the create-period button in
`periods-tab.tsx`.

#### Scenario: focus returns to the trigger when an admin dialog closes

- **WHEN** an open admin CRUD dialog closes via Escape, Cancel, overlay click,
  or a successful save
- **THEN** keyboard focus returns to the trigger control that opened the dialog
- **AND** focus is not left on `<body>`

#### Scenario: a regression test asserts restore-on-close per admin dialog

- **WHEN** the co-located test for each admin dialog runs
- **THEN** it opens the dialog from a trigger, closes it, and asserts focus is
  back on that trigger
- **AND** an edit that drops the restore-on-close wiring fails the test

### Requirement: Admin entity dialogs MUST remain open while Save is pending

The users, products, activities, and groups dialogs MUST reject every dismissal
path while their save mutation is pending. Escape, Cancel, and overlay clicks
MUST leave the dialog mounted until the mutation settles, preventing an admin
from losing the visible operation context or starting a conflicting edit.

#### Scenario: dismissal is rejected during a pending save

- **GIVEN** a users, products, activities, or groups save mutation is pending
- **WHEN** the admin presses Escape, clicks Cancel, or clicks the overlay
- **THEN** the dialog remains open
- **AND** the Cancel action is disabled

#### Scenario: pending-save dismissal has regression coverage

- **WHEN** the co-located dialog tests run
- **THEN** they assert that Escape and overlay clicks do not close a saving
  dialog
- **AND** an edit that routes either path around the pending-save guard fails
  the test

### Requirement: Period dialogs remain keyboard reachable in a zoomed viewport

The create/edit period dialog MUST fit within the dynamic viewport and expose
an internal vertical scroll path when its content is taller than the available
space. Its existing focus, dismissal, pending, and action behavior remains.

#### Scenario: period form exceeds the available viewport height

- **WHEN** browser zoom or viewport height leaves less space than the form needs
- **THEN** the dialog surface is bounded by the dynamic viewport
- **AND** the user can scroll within the dialog to reach Cancel and Submit

### Requirement: A pending entity save locks its editable draft

Users, products, activities and groups dialogs MUST disable their editable form
controls while their own save is pending. Existing pending dismissal guards MUST
remain in effect. A failed save MUST preserve the draft and release the controls.
Tab and Shift+Tab MUST remain inside the dialog even when every control is
disabled; its surface MUST provide the focus target in that state.

#### Scenario: Entity save is pending

- **GIVEN** an entity dialog submits its current draft
- **WHEN** the save has not settled
- **THEN** the editable fields cannot accept unsent replacement values
- **AND** the dialog remains open with the submitted values visible

#### Scenario: Entity save fails

- **WHEN** the pending entity save fails
- **THEN** the same draft remains in the open dialog
- **AND** the controls become editable for correction or retry

#### Scenario: Keyboard focus stays inside a pending dialog

- **GIVEN** every control in a pending entity dialog is disabled
- **WHEN** the admin presses Tab or Shift+Tab
- **THEN** focus stays on the dialog surface instead of moving to the page behind it
- **AND** after the save settles, keyboard navigation reaches enabled controls again

### Requirement: Destructive period confirmation MUST identify the selected period

The period deletion confirmation MUST show the selected period label and date range together with the existing permanent-deletion consequence. Opening or cancelling the confirmation MUST NOT execute the deletion command.

#### Scenario: An administrator reviews period deletion

- **WHEN** an administrator opens Delete for a period
- **THEN** the confirmation shows that selected period's label and date range
- **AND** no deletion occurs before explicit confirmation

#### Scenario: An administrator cancels period deletion

- **WHEN** an administrator cancels the selected period's deletion confirmation
- **THEN** the dialog closes without executing deletion

### Requirement: The users delete confirmation MUST remain open while deletion is pending

The users tab delete confirmation
(`apps/web/src/features/admin/ui/users-tab.tsx`, shared `ConfirmDeleteDialog`)
MUST stay mounted while the `admin.deleteUser` mutation is pending. Confirm,
Cancel, Escape, and overlay dismissal MUST be inert during the request and
MUST NOT issue a second delete request. The confirmation MUST close after the
mutation settles — on success and on failure — while the existing success and
error notifications remain unchanged.

#### Scenario: Dismissal and duplicate submit are locked during a pending delete

- **GIVEN** the admin confirmed Delete for a user and the delete request is
  pending
- **WHEN** the admin presses Escape, clicks Cancel, clicks the overlay, or
  repeats Confirm
- **THEN** the confirmation remains open with Confirm and Cancel disabled
- **AND** exactly one delete request is issued

#### Scenario: A successful delete closes the confirmation

- **WHEN** the pending delete succeeds
- **THEN** the confirmation closes, the existing success notification appears,
  and focus returns to the row trigger

#### Scenario: A failed delete still closes the confirmation

- **WHEN** the pending delete fails
- **THEN** the confirmation closes and the existing error notification reports
  the failure

#### Scenario: Pending-delete behavior has regression coverage

- **WHEN** the co-located users tab test runs
- **THEN** it asserts the confirmation stays open and inert while the delete
  is pending and closes after success and after failure
- **AND** an edit that closes the confirmation before settlement fails the
  test
