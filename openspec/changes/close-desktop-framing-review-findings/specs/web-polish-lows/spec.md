## ADDED Requirements

### Requirement: The selected desktop period remains fully readable beside state badges

The lead report `PeriodNavigator` MUST show the complete selected period label at the canonical 1280 px desktop viewport when a submission-state badge is present. The trigger MUST NOT truncate or obscure either the date range or the badge.

#### Scenario: A submitted lead section uses the desktop period selector

- **WHEN** a lead views a submitted report at a 1280 by 720 viewport
- **THEN** the selected period's full date-range label is visible
- **AND** the `Submitted` badge remains visible without overlapping the label or disclosure icon

### Requirement: Activity lead counts use grammatical number

The admin Activities surface MUST render the attached-lead count with the singular noun for exactly one lead and the plural noun for every other count.

#### Scenario: One lead is attached to an activity

- **WHEN** an activity has exactly one attached lead
- **THEN** its summary reads `1 lead`
- **AND** it does not read `1 leads`

#### Scenario: Zero or multiple leads are attached to an activity

- **WHEN** an activity has zero or more than one attached lead
- **THEN** its summary uses the plural noun `leads`

## MODIFIED Requirements

### Requirement: Clearing a period's end date or deadline is an explicit clear, not a silent no-op

Ruling F16 (Sasha, 2026-07-24, variant "a"): the explicit clear is real for
the **deadline only**. `periods-tab-dialog`'s edit-mode submit handler MUST
submit an explicit `null` for `deadline` when an existing value is cleared to
an empty string, distinct from the create-mode empty case which MUST continue
to omit the field (`undefined`). The server MUST treat `deadline: null` as a
real deletion - the period then has no deadline and every deadline-driven
consumer handles that state explicitly.

Clearing `periodEnd` is NOT a deletion: a period must end. An edit-mode
clear of `periodEnd` MUST fail loudly with a field validation error, never
silently keep the old value. In edit mode the field MUST be presented visually
and accessibly as required; it MUST NOT be labelled optional. Create mode MUST
continue to present an unset `periodEnd` as optional because the server derives
the default end date.

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

#### Scenario: Edit mode identifies the period end as required

- **WHEN** a head opens the edit-period dialog
- **THEN** the period-end label uses the required-field presentation
- **AND** the period-end input exposes required semantics to assistive technology
- **AND** neither its visible nor accessible label says `optional`

#### Scenario: Create mode still omits an unset end date

- **WHEN** a head creates a period leaving the end-date field empty
- **THEN** the field remains visibly and accessibly optional
- **AND** the submitted payload omits `periodEnd` (`undefined`), and the
  server derives the default end date
