## ADDED Requirements

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
