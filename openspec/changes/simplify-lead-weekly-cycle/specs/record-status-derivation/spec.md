# Spec Delta

## MODIFIED Requirements

### Requirement: One stored progress vocabulary independent of week placement

`ItemWorkflowStatus` MUST remain the single stored progress source: `planned | in_progress | paused | postponed | done`. Current and Next MUST accept the same vocabulary. Current `planned` means Not started. The system MUST NOT store `blocked` on an Item or persist a separate completion flag. `paused` MUST retain a nonblank `pausedReason`; every non-paused status MUST clear it. Paused and postponed work MUST NOT feed blocked or at-risk escalation. Week placement, progress, derived alarm, and carried confirmation are independent dimensions.

At rollover, an explicit next-period commitment MUST become Current `planned`; a fallback continuation of Current `in_progress` MUST remain `in_progress`. Both MUST be marked carried and unconfirmed until the lead explicitly updates the target occurrence. No other progress status is automatically activated.

#### Scenario: In-progress work moves to Next without changing progress

- **WHEN** an authorized lead explicitly moves a Current `in_progress` item to Next
- **THEN** validation, persistence, and projection accept Next `in_progress`
- **AND** the move does not rewrite progress or create a duplicate

#### Scenario: next item accepts only its vocabulary

- **WHEN** a save payload carries a Next item status
- **THEN** validation accepts exactly `planned`, `in_progress`, `paused`, `postponed`, or `done`
- **AND** it rejects alarms and unknown values

#### Scenario: paused work does not escalate

- **WHEN** a section contains only paused or postponed items and no risks
- **THEN** dashboard and product health show no escalation caused by those items

#### Scenario: carry-over stays planned until progress is confirmed; postponed stays behind

- **WHEN** automatic carry-over consumes an eligible Next item or Current next commitment
- **THEN** the created Current item is `planned`, carried, and unconfirmed
- **AND** it is not automatically changed to `in_progress`

#### Scenario: Carry-over preserves planned work without asserting progress

- **WHEN** automatic carry-over copies an explicit commitment into the new Current period
- **THEN** the created Current item remains `planned`, is marked unconfirmed, and is not automatically changed to `in_progress`

#### Scenario: fallback continuation retains in-progress without confirming a result

- **WHEN** automatic carry-over continues a Current `in_progress` item that has no next commitment
- **THEN** the created Current item remains `in_progress`, carried, and unconfirmed
- **AND** the copied text is not counted as a confirmed result until the lead updates it

#### Scenario: Paused work keeps its reason across placement

- **WHEN** a paused item with a valid pause reason is moved explicitly between Current and Next
- **THEN** its status and pause reason are preserved

#### Scenario: Postponed work can be moved to Current explicitly

- **WHEN** an authorized lead moves a Next postponed item to Current
- **THEN** its postponed status is preserved until explicitly changed

#### Scenario: Risk-derived alarms do not become stored status

- **WHEN** an item with a covering risk moves between Current and Next
- **THEN** stored progress remains unchanged and the displayed alarm is derived again
