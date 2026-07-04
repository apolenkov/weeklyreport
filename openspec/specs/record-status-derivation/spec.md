# record-status-derivation Specification

## Purpose

TBD - created by archiving change record-status-derived-from-risk. Update Purpose after archive.

## Requirements

### Requirement: An item's alarm status is a derived roll-up of its covering risks

An item card's at-risk/blocked pill MUST be derived at render from the risk rows
that cover the item, never set as a free workflow choice. The DISPLAYED alarm is
the highest severity among the covering risks (precedence: blocked > at-risk).
**Only an in-progress item is eligible for the derived alarm**: a completed
(`done`) item and a planned (next-week) item are NEVER floored — a covering risk
pertains to in-flight work on the stage, not to finished or not-yet-started work,
so a completed/planned item keeps its progress status even when a risk covers its
product and stage. An eligible item is COVERED by a risk when both live in the
same `ReportSection`, name the same product, and their SDLC stages overlap —
where an empty `stageNames` on the risk means "all of the author's assigned
stages on that product" (the canonical wildcard from
`escalation-types-and-flagged-red-rollup`) and therefore covers the item
regardless of the item's stage. Coverage is stage-grained, so one risk floors
EVERY co-located in-progress item on that product/stage (see `design.md`
Decision 1). With no covering risk the item shows its progress status
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

#### Scenario: clearing a covered blocked item from the card is refused

- **GIVEN** a blocked item covered by an own risk
- **WHEN** the lead attempts to mark it in-progress from the card
- **THEN** the change is not applied
- **AND** a message directs the lead to resolve the covering risk/blocker first

#### Scenario: a foreign covering risk locks the alarm with attribution

- **GIVEN** an item on a co-owned product whose covering risk belongs to another lead
- **WHEN** the item card renders
- **THEN** the alarm pill is shown
- **AND** the lock message names the other author instead of offering deletion

### Requirement: Setting an item to at-risk/blocked routes through blocker creation

An attempt to set an uncovered item to at-risk or blocked MUST route through
risk (blocker) creation instead of storing a free alarm on the item: the risk
edit dialog opens in create mode prefilled with the item's product, the item's
stage, and the chosen severity. On cancel the item is unchanged and no risk row
is created. The quick-add "blocker"
(`apps/web/src/components/lead/quick-add-button.tsx`) creates a blocker record —
a risk of severity `blocked` — not a free-blocked item.

#### Scenario: choosing Blocked on an uncovered item opens the risk dialog

- **GIVEN** an item with no covering risk
- **WHEN** the lead chooses the Blocked alarm for it
- **THEN** the risk edit dialog opens in create mode with severity blocked, the item's product, and the item's stage prefilled
- **AND** the item's stored status is not changed to a free alarm

#### Scenario: cancelling the prefilled blocker dialog leaves the item unchanged

- **GIVEN** the risk dialog opened by an item alarm gesture
- **WHEN** the lead cancels it
- **THEN** no risk row is created
- **AND** the item keeps its previous progress status

#### Scenario: the blocker quick-add creates a blocker record

- **GIVEN** the lead activates the quick-add "blocker" affordance
- **WHEN** the entry dialog opens
- **THEN** it is the risk (blocker) dialog with severity blocked, not an item with a free-blocked status

### Requirement: No stored item alarm exists without a covering risk

`at-risk` MUST never be a stored `Item` status — the amber item pill is produced
only by a covering at-risk risk at render — and no stored `blocked` may exist
without a covering blocked-severity risk in the same section, product, and stage.
The raw stored `workflowStatus` and the displayed alarm are SEPARATE layers
(mirroring the raw-vs-displayed split in `status-risk-unification`): the stored
value carries the lead's progress intent, the displayed alarm is the covering-risk
roll-up. A legacy `blocked` item with no covering risk is healed by the change's
migration (see `design.md`) so no blocked signal is silently dropped and the
displayed pill never disagrees with a stored value.

#### Scenario: at-risk is display-only for items

- **GIVEN** an item covered by an at-risk risk
- **WHEN** the item is persisted by saveSection
- **THEN** its stored `workflowStatus` is a progress value, not an alarm
- **AND** the amber At Risk pill is reproduced from the covering risk at the next render

#### Scenario: a legacy unbacked blocked item is healed by migration

- **GIVEN** a persisted item with `workflowStatus=blocked` and no covering risk row
- **WHEN** the change's migration/backfill runs
- **THEN** a covering blocked-severity risk is synthesized for the item's section, product, and stage
- **AND** the item's blocked signal survives as the covering risk, keeping stored state and the displayed pill in agreement

### Requirement: The escalation roll-up does not double-count a blocked item and its blocker

The escalation roll-up MUST NOT emit a blocked item and its covering blocker as
two separate escalations for the same underlying problem. The builder is
`buildEscalationsFromReadSections` in
`apps/api/src/modules/published-report-snapshot.ts`. Because a displayed
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
