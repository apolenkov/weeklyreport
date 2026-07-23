## MODIFIED Requirements

### Requirement: Clearing a period's end date or deadline is an explicit clear, not a silent no-op

Ruling F16 (Sasha, 2026-07-24, вариант «а»): the explicit clear is real for
the **deadline only**. `periods-tab-dialog`'s edit-mode submit handler MUST
submit an explicit `null` for `deadline` when an existing value is cleared to
an empty string, distinct from the create-mode empty case which MUST continue
to omit the field (`undefined`). The server MUST treat `deadline: null` as a
real deletion — the period then has no deadline and every deadline-driven
consumer handles that state explicitly.

Clearing `periodEnd` is NOT a deletion: a period must end. An edit-mode
clear of `periodEnd` MUST fail loudly with a field validation error, never
silently keep the old value.

#### Scenario: Clearing an existing period's deadline deletes it

- **WHEN** a head edits a period that has a deadline, clears the deadline
  field, and submits
- **THEN** the submitted payload carries `deadline: null`
- **AND** after the save the period has no deadline
- **AND** the audit event `period.manual-edit` carries
  `changes.deadline = { from: <previous ISO>, to: null }`

#### Scenario: Clearing an existing period's end date is rejected loudly

- **WHEN** a head edits a period, clears the end-date field, and submits
- **THEN** the form shows a field validation error naming `periodEnd` as
  required
- **AND** no update request mutates the period

#### Scenario: Create mode still omits an unset end date

- **WHEN** a head creates a period leaving the end-date field empty
- **THEN** the submitted payload omits `periodEnd` (`undefined`), and the
  server derives the default end date
