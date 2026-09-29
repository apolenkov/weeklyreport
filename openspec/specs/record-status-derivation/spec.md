# record-status-derivation Specification

## Purpose

Derive item alarm state from covering risks while keeping progress status, blocker creation, pause reasons, and escalation counts coherent across edit surfaces.

## Requirements

### Requirement: An item's alarm status is a derived roll-up of its covering risks

An item card's at-risk/blocked pill MUST be derived at render from the risk rows
that cover the item, never set as a free workflow choice. The DISPLAYED alarm is
the highest severity among the covering risks (precedence: blocked > at-risk).
**Only an in-progress item is eligible for the derived alarm**, regardless of
its Current or Next placement: a completed (`done`) item and an item whose
progress is `planned` are NEVER floored — a covering risk
pertains to in-flight work on the stage, not to finished or not-yet-started work,
so a completed/planned item keeps its progress status even when a risk covers its
product and stage. An eligible item is COVERED by a risk when both live in the
same `ReportSection`, name the same product, and their SDLC stages overlap —
where the risk's `stageNames` explicitly overlaps the item's stage. An empty
`stageNames` is valid only for an activity-parented risk, which has no product
stage to cover. Coverage is stage-grained, so one risk floors
EVERY co-located in-progress item on that product/stage. With no covering risk
the item shows its progress status
(`in-progress` / `completed` / `planned`) and no alarm. The derivation reuses the
stage-chip render-floor mechanism (`deriveEffectiveStageStatus`), applied to the
item via a shared helper.

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
- **THEN** the item's status pill shows At Risk with the amber token set

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

### Requirement: A covered item's alarm is locked and directs the lead to the risk

When a covering risk/blocker exists, the lead MUST NOT be able to clear or
downgrade the item's alarm from the item card or the item edit dialog. The
alarm-setting controls are removed or disabled and an inline message names the
consequence — resolve the covering risk/blocker first. When the covering risk
belongs to another author (a co-owned product), the alarm still renders but the
message names the other author and the lead cannot delete foreign data, mirroring
the stage-chip foreign handling in `status-risk-unification`.

#### Scenario: the item dialog of a covered item offers no free alarm chip

- **GIVEN** a lead opens the edit dialog of an item covered by an own blocked risk
- **WHEN** the dialog renders its status controls
- **THEN** no free at-risk/blocked chip is offered
- **AND** an inline message states the status is locked and to resolve the covering risk/blocker first

#### Scenario: a covered current item offers no card alarm-edit control

- **GIVEN** an in-progress current item whose alarm is derived from an own covering risk
- **WHEN** the item card renders its status actions
- **THEN** no card control can directly edit, clear, or downgrade the derived alarm
- **AND** a message directs the lead to resolve the covering risk/blocker first

#### Scenario: a foreign covering risk locks the alarm with attribution

- **GIVEN** an item on a co-owned product whose covering risk belongs to another lead
- **WHEN** the item card renders
- **THEN** the alarm pill is shown
- **AND** the lock message names the other author instead of offering deletion

### Requirement: Setting an item to at-risk/blocked routes through blocker creation

The system MUST NOT offer any item-level gesture that stores an alarm on the item. Blockers are created in Risks & Blockers or via the quick-add "blocker" entry (`apps/web/src/features/report-pages/ui/lead/chrome/quick-add-button.tsx`) — a risk of severity `blocked`, never a free-blocked item. No item dialog may expose a separate "mark as blocked" gesture.

#### Scenario: the blocker quick-add creates a blocker record

- **GIVEN** the lead activates the quick-add "blocker" affordance
- **WHEN** the entry dialog opens
- **THEN** it is the risk (blocker) dialog with severity blocked, not an item with a free-blocked status

#### Scenario: no item gesture stores an alarm

- **GIVEN** the item edit dialog of an uncovered current item
- **WHEN** its status controls render
- **THEN** no blocked/at-risk choice or gesture is present, and the stored status can only take the item type's progress vocabulary

### Requirement: No stored item alarm exists without a covering risk

No alarm MUST ever be stored on an item: the `ItemWorkflowStatus` enum carries progress values only (`planned | in_progress | paused | postponed | done`) — `at-risk` and `blocked` are not representable as stored item statuses. The displayed alarm remains the covering-risk roll-up at render (the raw-vs-displayed split of `status-risk-unification` is unchanged).

#### Scenario: at-risk is display-only for items

- **GIVEN** an item covered by an at-risk risk
- **WHEN** the item is persisted by saveSection
- **THEN** its stored `workflowStatus` is a progress value, not an alarm
- **AND** the amber At Risk pill is reproduced from the covering risk at the next render

#### Scenario: blocked cannot be persisted at all

- **GIVEN** any save payload that tries to store `blocked` as an item status
- **THEN** shared validation rejects it — the blocked signal exists only as a blocked-severity risk covering the item

### Requirement: The escalation roll-up does not double-count a blocked item and its blocker

The escalation roll-up MUST NOT emit a blocked item and its covering blocker as
two separate escalations for the same underlying problem. The builder is
`buildEscalationsFromReadSections` in
`packages/shared/src/schemas/report/report-escalations.ts`. Because a displayed
item-blocked is now backed by a covering
blocked-severity risk, the `blocked` and `unresolved_risk` escalations that a
single blocker would otherwise produce MUST be reconciled to one signal per
blocker, so the roll-up count does not inflate.

#### Scenario: a blocked item and its covering blocker yield one escalation

- **GIVEN** a section with a blocked item whose blocked pill is backed by exactly one covering blocked-severity risk
- **WHEN** the escalation builder runs over the section
- **THEN** the blocked item and its covering blocker contribute one escalation for that problem, not two
- **AND** the live dashboard and the published-report snapshot receive the same reconciled count

#### Scenario: an independent unresolved risk is unaffected

- **GIVEN** an at-risk risk that covers no blocked item
- **WHEN** the escalation builder runs
- **THEN** it still emits the `unresolved_risk` escalation for that risk unchanged

### Requirement: The item dialog and quick-add surface the derived-alarm UX in full

The item edit dialog and Overview editor MUST offer the same five progress states in Current and Next: Planned (labelled Not started in the Current dialog), In Progress, Paused, Postponed, and Completed. An existing item's progress MUST remain visibly selected after changing week placement, and editing unrelated fields MUST preserve it and any required pause reason. Neither editor may offer an in-dialog "mark as blocked" affordance — the only path to a blocked item is creating a blocker in Risks & Blockers (the quick-add "Blocker" entry keeps creating a blocked-severity risk). The covered-status lock stays: when a covering risk floors the item, an inline message replaces the status chips, stating the status is set by the covering risk/blocker and to resolve it to change.

#### Scenario: a covered item's dialog shows the locked message

- **GIVEN** the lead opens the edit dialog of an item that a covering risk floors
- **WHEN** the dialog renders its status controls
- **THEN** an inline message replaces the status chips, stating the status is set by the covering risk/blocker and to resolve it to change

#### Scenario: the dialog offers every supported progress status

- **GIVEN** the lead opens the edit dialog of a next item
- **WHEN** the status chips render
- **THEN** the choices are exactly Planned, In Progress, Paused, Postponed, and Completed, with the existing progress selected
- **AND** editing the description preserves that progress and its pause reason; no alarm choice or blocked gesture is offered

#### Scenario: the quick-add "Blocker" defaults to blocked severity

- **GIVEN** the lead activates the quick-add "Blocker" entry
- **WHEN** the risk dialog opens
- **THEN** its severity is pre-set to blocked (not the pipeline-derived default)
- **AND** saving without a manual severity change creates a blocked-severity risk

#### Scenario: a foreign covering risk names the other author in the lock

- **GIVEN** an item on a co-owned product whose covering risk belongs to another lead
- **WHEN** the item card renders the locked alarm
- **THEN** the lock names the covering risk's author so the lead knows whom to talk to

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

### Requirement: Pausing an item requires and records a reason

When a lead pauses an item, the UI MUST require a non-blank reason before the
pause takes effect, and the reason MUST be persisted with the item
(`Item.pausedReason`) and surfaced on the item card. Both pause entry points —
the quick "Pause" action on a current-week card and the "Paused" status choice
in the item edit dialog — MUST enforce the reason. This is a hard invariant at
every write boundary: a paused item MUST have a non-blank trimmed
`pausedReason`, and every non-paused item MUST have `pausedReason = null` (or
omit it before persistence). Leaving the paused status clears the reason.

#### Scenario: the quick pause action requires a reason

- **WHEN** the lead clicks Pause on a current-week in-progress item
- **THEN** a reason prompt opens and the item is not paused until a non-blank
  reason is confirmed
- **AND** the confirmed reason is persisted and shown on the card as a
  "Paused: …" line

#### Scenario: the edit dialog requires a reason for the paused status

- **WHEN** the lead selects the Paused status in the item edit dialog
- **THEN** a required reason field appears and the item cannot be saved while it
  is blank

#### Scenario: editing a paused item preserves its reason

- **GIVEN** a paused item with a reason
- **WHEN** the lead opens the edit dialog, changes an unrelated field, and saves
  while keeping the Paused status
- **THEN** the pause reason is preserved, not dropped

#### Scenario: leaving the paused status clears the reason

- **GIVEN** a paused item with a reason
- **WHEN** the item moves to any non-paused status
- **THEN** its pause reason is cleared
