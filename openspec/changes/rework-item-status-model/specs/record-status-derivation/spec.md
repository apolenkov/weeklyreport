# record-status-derivation (delta)

## ADDED Requirements

### Requirement: One stored progress status per item, with per-type vocabularies

`ItemWorkflowStatus` (Prisma enum + shared Zod item schemas) MUST be the single stored source of an item's progress: `planned | in_progress | paused | postponed | done`. The system MUST NOT store `blocked` on an item (alarms derive from covering risks) and MUST NOT carry a separate completed flag (`Item.completed` is removed). Shared Zod MUST reject a status outside the item type's vocabulary: current → `in_progress | paused | done`; next → `planned | postponed`. `paused` and `postponed` roll up as not-done and MUST NOT feed the blocked/at-risk escalation paths.

#### Scenario: next item accepts only its vocabulary

- **WHEN** a save payload carries a next item with status `in_progress`
- **THEN** shared validation rejects it; `planned` and `postponed` pass

#### Scenario: paused work does not escalate

- **WHEN** a section contains only `paused`/`postponed` items and no risks
- **THEN** the dashboard blocked/at-risk tables and product health show no escalation caused by those items

#### Scenario: carry-over materializes as in-progress; postponed stays behind

- **WHEN** the carry-over run copies a `planned` next item into the new period
- **THEN** the created current item is `in_progress`
- **AND** `postponed` items are not carried — re-planning them is an explicit lead action

## MODIFIED Requirements

### Requirement: Setting an item to at-risk/blocked routes through blocker creation

The system MUST NOT offer any item-level gesture that stores an alarm on the item. Blockers are created in Risks & Blockers or via the quick-add "blocker" entry (`apps/web/src/components/lead/quick-add-button.tsx`) — a risk of severity `blocked`, never a free-blocked item. The former in-dialog "mark as blocked" gesture is removed.

#### Scenario: the blocker quick-add creates a blocker record

- **GIVEN** the lead activates the quick-add "blocker" affordance
- **WHEN** the entry dialog opens
- **THEN** it is the risk (blocker) dialog with severity blocked, not an item with a free-blocked status

#### Scenario: no item gesture stores an alarm

- **GIVEN** the item edit dialog of an uncovered current item
- **WHEN** its status controls render
- **THEN** no blocked/at-risk choice or gesture is present, and the stored status can only take the item type's progress vocabulary

### Requirement: The item dialog and quick-add surface the derived-alarm UX in full

The item edit dialog MUST offer exactly the item type's status vocabulary (current → In Progress | Paused | Completed; next → Planned | Postponed) and MUST NOT offer an in-dialog "mark as blocked" affordance — the only path to a blocked item is creating a blocker in Risks & Blockers (the quick-add "Blocker" entry keeps creating a blocked-severity risk). The covered-status lock stays: when a covering risk floors the item, an inline message replaces the status chips, stating the status is set by the covering risk/blocker and to resolve it to change.

#### Scenario: a covered item's dialog shows the locked message

- **GIVEN** the lead opens the edit dialog of an item that a covering risk floors
- **WHEN** the dialog renders its status controls
- **THEN** an inline message replaces the status chips, stating the status is set by the covering risk/blocker and to resolve it to change

#### Scenario: the dialog never offers foreign-type or alarm statuses

- **GIVEN** the lead opens the edit dialog of a next item
- **WHEN** the status chips render
- **THEN** the choices are exactly Planned and Postponed — no In Progress, no blocked gesture

#### Scenario: the quick-add "Blocker" defaults to blocked severity

- **GIVEN** the lead activates the quick-add "Blocker" entry
- **WHEN** the risk dialog opens
- **THEN** its severity is pre-set to blocked (not the pipeline-derived default)
- **AND** saving without a manual severity change creates a blocked-severity risk

#### Scenario: a foreign covering risk names the other author in the lock

- **GIVEN** an item on a co-owned product whose covering risk belongs to another lead
- **WHEN** the item card renders the locked alarm
- **THEN** the lock names the covering risk's author so the lead knows whom to talk to
