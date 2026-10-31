## ADDED Requirements

### Requirement: Focus MUST NOT be lost when Dismiss or Delete removes the acting control

When a confirmed Dismiss or Delete removes the control that opened its workflow
(the Dismiss action of a now-dismissed record, or the whole record card),
keyboard focus MUST move to a stable control in the workbench instead of being
dropped to the document body. Dismiss MUST move focus to the `Details` button of
the same record. Delete MUST move focus to the `Details` button of the adjacent
record (the next, otherwise the previous) or, when no record remains, to the list
heading. A cancelled or failed workflow MUST keep returning focus to its opener.

#### Scenario: Dismiss keeps focus on the record

- **GIVEN** a reviewer confirmed Dismiss with a reason and the record now shows
  `Dismissed`
- **WHEN** the dismissal succeeds
- **THEN** the record's `Details` button has focus

#### Scenario: Delete moves focus to the next record

- **GIVEN** an admin deletes a record that has a following record in the list
- **WHEN** the deletion succeeds
- **THEN** the following record's `Details` button has focus

#### Scenario: Deleting the last record moves focus to the previous record

- **WHEN** an admin deletes the last record of a list with earlier records
- **THEN** the previous record's `Details` button has focus

#### Scenario: Deleting the only record moves focus to the heading

- **WHEN** an admin deletes the only listed record
- **THEN** the list heading `Feedback` has focus

#### Scenario: A failed Delete keeps the dialog and its focus

- **WHEN** the delete request fails
- **THEN** the confirmation stays open and focus does not move to another record
