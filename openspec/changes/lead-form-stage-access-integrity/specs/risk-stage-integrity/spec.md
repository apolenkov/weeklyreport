## ADDED Requirements

### Requirement: Lead-Authored Records Carry Only Stages the Author Owns

The server SHALL reject a section write whose new or changed item / risk / decision
row carries a stage the section's author does not own on that row's product, on both
`saveDraft` and `submitSection`.

A shared pure validator (`validateStageOwnership(section, input)`) MUST run on BOTH
write paths — draft-save persists rows too, and the integrity rule applies to every
add/edit form. For each new/changed row (identified by a per-row-id diff against the
server-loaded section) it MUST confirm every stage name is one the **section
author** owns on that row's product, comparing canonical stage names (`stageNamesMatch`,
honoring the Dev/Development alias) against the server-loaded `ownedStages`
(StageAssignment-derived) — never trusting the client payload. On a violation it MUST
throw a `STAGE_NOT_OWNED` domain error (`BAD_REQUEST`); it MUST NOT silently drop or
clamp the offending stage. The author's owned stages are the reference even when a
head or admin edits the section on the author's behalf.

#### Scenario: Lead submits a record into an unowned stage

- **GIVEN** a lead who owns only the Testing stage on product P
- **WHEN** a `saveDraft` or `submitSection` payload carries a new risk on P with the DevOps stage
- **THEN** the write is rejected with `STAGE_NOT_OWNED`
- **AND** no row is persisted

#### Scenario: Lead writes a record into an owned stage

- **GIVEN** a lead who owns the Testing stage on product P
- **WHEN** the payload carries a new item on P with the Testing stage
- **THEN** the write succeeds

#### Scenario: Head editing on-behalf cannot inject an unowned stage

- **GIVEN** a head editing a lead's section, where the lead owns only Testing on P
- **WHEN** the head's payload adds a record on P with the DevOps stage
- **THEN** the write is rejected with `STAGE_NOT_OWNED` (the guard scopes to the section author's owned stages, not the editor's)

#### Scenario: Unchanged legacy rows are grandfathered

- **GIVEN** an existing section with a legacy row referencing a product the author owns no stage on (a `fix-lead-surface-name-resolution` case)
- **WHEN** the lead saves the section without changing that row
- **THEN** the unchanged row is not re-validated and the save succeeds
- **AND** only new/changed rows are subject to the ownership guard

### Requirement: The Record Dialogs Scope Stage Options to the Author's Owned Stages

The item, risk, and decision dialogs SHALL offer only the stages the lead owns on the
selected product, re-scoping the stage options whenever the product changes, and SHALL
never allow saving a record with no stage.

When the lead owns exactly one stage on the selected product, that stage MUST be
visibly pre-selected and locked (non-deselectable, non-clickable). When the lead owns
two or more, the selection MUST clear on a product change and the lead MUST pick at
least one. When the lead owns zero stages on the selected product (reachable only by
editing a legacy/cross row), Save MUST be disabled with an inline notice ("no stages
assigned on <product> — contact admin") and the keyboard save shortcut MUST be a
no-op — for the **item and decision** dialogs. The risk dialog's zero-owned-stage
dead-end is owned by `risk-stage-integrity`'s "The risk dialog never dead-ends on a
zero-owned-stage product" (the in-flight `fix-risk-stage-integrity-impl`); this
requirement extends that same dead-end pattern to the item and decision dialogs, so the
two changes never both specify the risk dialog. This client scoping is convenience over
the server guard, not a substitute for it.

#### Scenario: Single owned stage is pre-selected and locked

- **GIVEN** a lead who owns exactly one stage on the selected product
- **WHEN** the lead opens the item / risk / decision dialog for that product
- **THEN** that stage is pre-selected and cannot be deselected

#### Scenario: Product change re-scopes the stage options

- **GIVEN** a lead owning Testing on product P and DevOps on product Q
- **WHEN** the lead changes the dialog's product from P to Q
- **THEN** the stage options re-scope to Q's owned stages (DevOps), and P's Testing is no longer offered

#### Scenario: Zero owned stages disables save on the item and decision dialogs

- **GIVEN** a lead editing an item or decision whose selected product is one the lead owns no stage on
- **WHEN** the dialog renders
- **THEN** Save is disabled with the "no stages assigned" notice
- **AND** the keyboard save shortcut does nothing
- **AND** the risk dialog's equivalent dead-end is covered by `risk-stage-integrity`'s "The risk dialog never dead-ends on a zero-owned-stage product" (`fix-risk-stage-integrity-impl`)
