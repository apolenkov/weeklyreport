## ADDED Requirements

### Requirement: Manual period dialogs reject reversed date envelopes

The Admin Periods create and edit dialogs MUST show an inline end-date error
and block submission when a supplied valid end date precedes its valid start
date, including when the deadline is empty. Correcting the range MUST remove
that error. A same-day range remains valid; create-mode omitted ends and
edit-mode explicit deadline clears MUST retain their existing semantics.

#### Scenario: Admin enters a reversed range

- **GIVEN** the Admin opens the New period or Edit period dialog
- **WHEN** valid supplied dates put the end before the start and the deadline is empty
- **THEN** the end field displays an associated inline error
- **AND** submission is disabled and no manual-period mutation is sent

#### Scenario: Admin corrects the range to the same calendar day

- **GIVEN** the dialog contains a reversed range
- **WHEN** the Admin changes its end to the start date
- **THEN** the range error clears and submission is enabled
- **AND** submission preserves the start and end-of-day UTC envelope
- **AND** an empty edit deadline remains an explicit null clear

#### Scenario: New period keeps its optional end

- **WHEN** the Admin creates a period without an explicit end date
- **THEN** the dialog does not report a range error solely because the end is empty
- **AND** the server retains ownership of the omitted-end default
