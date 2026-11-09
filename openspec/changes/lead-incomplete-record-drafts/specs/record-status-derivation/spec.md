## MODIFIED Requirements

### Requirement: An item's alarm status is a derived roll-up of its covering risks

An item card's at-risk/blocked pill MUST be derived at render from the risk rows that cover the item, never set as a free workflow choice; the displayed alarm is the highest covering severity (precedence: blocked > at-risk). **Only an in-progress item is eligible**, regardless of its Current or Next placement: a `done` or `planned` item is NEVER floored and keeps its progress status even when a risk covers its product and stage. An eligible item is COVERED when a risk lives in the same `ReportSection`, names the same product, and its `stageNames` explicitly overlaps the item's stage; empty `stageNames` is valid only for an activity-parented risk. Coverage is stage-grained, so one risk floors EVERY co-located in-progress item on that product/stage; with no covering risk the item shows its progress status (`in-progress` / `completed` / `planned`) and no alarm. The derivation reuses the stage-chip render-floor mechanism (`deriveEffectiveStageStatus`) via a shared helper.

Only complete risks participate in displayed item alarm derivation, including the author-private form and reviewer projections. An incomplete risk remains visible only to its authorized author, marked incomplete; omission counts for scoped reviewer surfaces are separate from alarms and do not assert that no risk exists.

#### Scenario: a covering blocked risk shows a locked blocked pill

- **GIVEN** an item on the Development stage of "CRM Platform" whose progress is in-progress
- **AND** an own risk of severity `blocked` covering "CRM Platform" / Development in the same section
- **WHEN** the item card renders
- **THEN** the item's status pill shows Blocked with the red token set
- **AND** the pill is presented as derived, not as a free choice

#### Scenario: a covering at-risk risk shows an at-risk pill

- **GIVEN** an item with no covering blocked risk
- **AND** an own risk of severity `at-risk` covering the item's product and stage
- **WHEN** the item card renders
- **THEN** the item's status pill shows At risk with the amber token set

#### Scenario: mixed-severity covering risks resolve to the highest

- **GIVEN** an item covered by one `at-risk` risk and one `blocked` risk on the same product and stage
- **WHEN** the item card renders
- **THEN** the pill shows Blocked (blocked outranks at-risk)

#### Scenario: no covering risk shows the progress status

- **GIVEN** an item whose product and stage are covered by no risk row
- **WHEN** the item card renders
- **THEN** the pill shows the item's progress status (in-progress / completed / planned)
- **AND** no at-risk or blocked alarm is shown

#### Scenario: a completed item under a covering risk stays completed

- **GIVEN** a completed (`done`) item on "CRM Platform" with no stage set
- **AND** an own risk of severity `at-risk` covering "CRM Platform" / Development in the same section
- **WHEN** the item card renders
- **THEN** the item pill stays Completed with no at-risk alarm
- **AND** a planned next-week item under the same covering risk likewise stays Planned

#### Scenario: removing the last covering risk clears the alarm

- **GIVEN** a blocked item whose only covering risk is deleted
- **WHEN** the item card re-renders
- **THEN** the pill reverts to the item's progress status
- **AND** no residual blocked alarm remains

#### Scenario: incomplete risk does not floor an item

- **WHEN** an in-progress item is covered only by an incomplete blocked risk
- **THEN** its author-private and reviewer-facing status remains its progress status
- **AND** the author sees the incomplete risk while scoped reviewers receive a separate omission indication without its text

### Requirement: The escalation roll-up does not double-count a blocked item and its blocker

The escalation roll-up MUST NOT emit a blocked item and its covering blocker as two separate escalations for the same underlying problem. The builder is `buildEscalationsFromReadSections` in `packages/shared/src/schemas/report/report-escalations.ts`. The `blocked` and `unresolved_risk` escalations a single blocker would otherwise produce MUST be reconciled to one signal per blocker, so the roll-up count does not inflate.

Only complete risks enter reviewer-facing and published escalation inputs; incomplete risks do not contribute risk or derived item escalations. Scoped omission disclosure is separate from the escalation count.

#### Scenario: a blocked item and its covering blocker yield one escalation

- **GIVEN** a section with a blocked item whose blocked pill is backed by exactly one covering blocked-severity risk
- **WHEN** the escalation builder runs over the section
- **THEN** the blocked item and its covering blocker contribute one escalation for that problem, not two
- **AND** the live dashboard and the published-report snapshot receive the same reconciled count

#### Scenario: an independent unresolved risk is unaffected

- **GIVEN** an at-risk risk that covers no blocked item
- **WHEN** the escalation builder runs
- **THEN** it still emits the `unresolved_risk` escalation for that risk unchanged

#### Scenario: incomplete risk is excluded from escalation input

- **WHEN** an incomplete blocked risk would otherwise cover an item
- **THEN** reviewer and published escalation counts exclude the incomplete risk and its derived item alarm
- **AND** an authorized omission indication is separate from the count
