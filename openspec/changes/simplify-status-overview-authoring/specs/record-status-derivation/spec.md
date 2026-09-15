## MODIFIED Requirements

### Requirement: One stored progress status per item, with per-type vocabularies

`ItemWorkflowStatus` (Prisma enum, shared Zod item schemas and database constraints) MUST remain the single stored source of an item's progress: `planned | in_progress | paused | postponed | done`. Current and Next MUST accept the same progress vocabulary so explicitly moving the one editable occurrence between those active-week buckets preserves its status. Current `planned` means Not started. The system MUST NOT store `blocked` on an item or persist a separate completion flag. `paused` MUST retain a nonblank `pausedReason`; every non-paused status MUST clear it. `paused` and `postponed` remain not-done and MUST NOT feed blocked/at-risk escalation paths. Week placement, progress status and risk-derived alarm are independent dimensions.

#### Scenario: In-progress work moves to Next without changing progress

- **WHEN** an authorized lead moves a Current `in_progress` item to Next
- **THEN** shared validation, persistence and projection accept the Next occurrence with `workflowStatus: in_progress`
- **AND** the move does not rewrite progress or create a duplicate

#### Scenario: next item accepts only its vocabulary

- **WHEN** a save payload carries a Next item with any stored progress value
- **THEN** shared validation accepts `planned`, `in_progress`, `paused`, `postponed`, or `done`
- **AND** it still rejects alarms and unknown values outside the single progress vocabulary

#### Scenario: paused work does not escalate

- **WHEN** a section contains only `paused` or `postponed` items and no risks
- **THEN** the dashboard blocked/at-risk tables and product health show no escalation caused by those items

#### Scenario: carry-over stays planned until progress is confirmed; postponed stays behind

- **WHEN** the carry-over run copies a `planned` Next item into the new period
- **THEN** the created Current item is `planned`, marked unconfirmed, and not automatically `in_progress`
- **AND** `postponed` items are not carried because replanning them remains an explicit lead action

#### Scenario: Paused work keeps its reason across placement

- **WHEN** a paused item with a valid pause reason moves between Current and Next
- **THEN** its status and pause reason are preserved

#### Scenario: Postponed work can be moved to Current explicitly

- **WHEN** an authorized lead moves a Next `postponed` item to Current
- **THEN** its postponed status is preserved until the lead explicitly changes it

#### Scenario: Risk-derived alarms do not become stored status

- **WHEN** an item with a covering risk moves between Current and Next
- **THEN** the stored progress status remains unchanged and the displayed alarm is derived again from the covering risk

#### Scenario: Carry-over preserves planned work without asserting progress

- **WHEN** automatic carry-over copies a Next `planned` item into the new Current period
- **THEN** the created Current item remains `planned`, is marked unconfirmed, and is not automatically changed to `in_progress`
