# record-status-derivation Specification

## ADDED Requirements

### Requirement: The item dialog and quick-add surface the derived-alarm UX in full

The item edit dialog and the quick-add "Blocker" entry MUST surface the full
locked-alarm and route-through-blocker experience, refining the shipped invariant
(the derived pill, the removed free chip, and the escalation/head re-sourcing) so
the lead is never left guessing why an item's status cannot be edited and a
"Blocker" always creates a blocker.

#### Scenario: a covered item's dialog shows the locked message

- **GIVEN** the lead opens the edit dialog of an item that a covering risk floors
- **WHEN** the dialog renders its status controls
- **THEN** an inline message replaces the alarm chips, stating the status is set by the covering risk/blocker and to resolve it to change

#### Scenario: an alarm gesture inside the dialog opens the prefilled blocker dialog

- **GIVEN** the lead opens the edit dialog of an uncovered item and asks to mark it blocked
- **WHEN** the gesture fires
- **THEN** the risk (blocker) dialog opens in create mode prefilled with the item's product, the item's stage, and severity blocked
- **AND** the item's stored status is not changed to a free alarm

#### Scenario: the quick-add "Blocker" defaults to blocked severity

- **GIVEN** the lead activates the quick-add "Blocker" entry
- **WHEN** the risk dialog opens
- **THEN** its severity is pre-set to blocked (not the pipeline-derived default)
- **AND** saving without a manual severity change creates a blocked-severity risk

#### Scenario: a foreign covering risk names the other author in the lock

- **GIVEN** an item on a co-owned product whose covering risk belongs to another lead
- **WHEN** the item card renders the locked alarm
- **THEN** the lock affordance names the other author instead of the generic lock copy
