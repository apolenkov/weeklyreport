## Purpose

A risk (and the escalation rows derived from it) must always carry its concrete
SDLC stage(s) so the report surfaces can resolve and display the stage instead
of a silent placeholder.

## Requirements

### Requirement: A risk always carries at least one concrete SDLC stage

A PRODUCT-parented risk, item, and decision MUST each reference at least one
concrete SDLC stage at every layer: the edit dialog blocks saving a stage-less
row, the shared write schemas (`riskWriteSchema`, `itemWriteSchema`,
`decisionWriteSchema`) enforce the product/activity stage rule through
`writeStageNamesField` and parent-aware superRefine checks, and seed data writes explicit stages on every seeded
product-parented risk, item, and decision. Empty selection MUST NOT mean
"applies to all assigned stages" for items or decisions; "all stages" is
expressed by selecting every owned stage.

This rule applies ONLY to a record whose parent is a PRODUCT. A record parented
to a project ACTIVITY carries no SDLC stage (an activity has no stage lane), so
the write schemas MUST accept an activity-parented risk, item, or decision with
an empty or absent `stageNames`, and the stage-required rule MUST NOT be applied to
it. The parent XOR is what discriminates: a product FK present means the stage
rule applies; an `activityId` present means it does not.

An activity-parented record carrying NO stage is not merely tolerated, it is
REQUIRED: the write schemas MUST REJECT a risk, item, or decision whose
`activityId` is set and whose `stageNames` is NON-empty. An activity owns no
stages, so a stage name on an activity-parented row can only be a spoofed or
stale owned-stage name and MUST fail validation. The `.superRefine` enforces
both directions: stage-required for a product parent, stage-forbidden for an
activity parent.

#### Scenario: saving a risk without a stage in the dialog

- **WHEN** the lead fills the risk text, impact, and mitigation but
  selects no stage and exactly one stage is not auto-applicable
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: the API receives a risk without stages

- **WHEN** a draft-save payload contains a PRODUCT-parented risk whose `stageNames`
  is missing or empty
- **THEN** validation fails and the payload is rejected

#### Scenario: the API receives an item without stages

- **WHEN** a draft-save or submit payload contains a PRODUCT-parented item whose
  `stageNames` is missing or empty
- **THEN** validation fails and the payload is rejected by `itemWriteSchema`

#### Scenario: the API receives a decision without stages

- **WHEN** a draft-save or submit payload contains a PRODUCT-parented decision
  whose `stageNames` is missing or empty
- **THEN** validation fails and the payload is rejected by `decisionWriteSchema`

#### Scenario: an activity-parented record is accepted without stages

- **WHEN** a draft-save or submit payload contains a risk, item, or decision
  whose parent is an activity (`activityId` set, product FK null) and whose
  `stageNames` is empty or absent
- **THEN** validation ACCEPTS the record — the stage-required rule does not apply
  to an activity parent

#### Scenario: an activity-parented record with a stage is rejected

- **WHEN** a draft-save or submit payload contains a risk, item, or decision
  whose parent is an activity (`activityId` set, product FK null) and whose
  `stageNames` is NON-empty
- **THEN** validation REJECTS the record — an activity owns no stage, so a
  stage-bearing activity row is not allowed

### Requirement: Items and decisions require a concrete stage in the edit dialog

An item or decision MUST reference at least one concrete SDLC stage when saved
through its edit dialog and the chosen product has at least one owned stage: the
dialog auto-applies a single owned stage and otherwise blocks saving a
stage-less row, exactly as the risk dialog does. Empty selection MUST NOT mean
"applies to all assigned stages" for items or decisions; "all stages" is
expressed by selecting every owned stage.

1. When the selected product has exactly one owned stage, the dialog MUST
   treat it as implicitly selected so the lead can save without a manual click.
2. When the selected product has two or more owned stages and none is selected,
   the dialog MUST block saving with "Select at least one stage."
3. When the selected product has no owned stages, the dialog MUST NOT force a
   stage — there is none to pick.
4. The `StageMultiSelect` helper copy MUST NOT advertise the empty selection as
   "apply to all assigned stages" when the host dialog requires a stage.

#### Scenario: saving an item without a stage on a multi-stage product

- **WHEN** the lead adds an item to a product where they own two or more stages
  and selects none
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: saving a decision on a single-owned-stage product

- **WHEN** the lead adds a decision and the product has exactly one owned stage
- **THEN** that stage is applied automatically and the decision saves with it

#### Scenario: the helper copy reflects the required rule

- **WHEN** the item or decision dialog renders its stage selector
- **THEN** the helper text does not say the selection is optional or that an
  empty selection applies to all assigned stages

### Requirement: Decision stage options follow the selected product

The Decision dialog MUST source its SDLC stage options from the SELECTED
product's owned stages and reset the selection when the product changes,
exactly as the item and risk dialogs do.

1. The stage options shown MUST be the owned stages of the currently selected
   product, not the union across all products.
2. Changing the product MUST re-scope the stage options to the new product and
   clear the prior selection.

#### Scenario: changing the product re-scopes decision stages

- **WHEN** a lead changes the Product picker in the Add decision dialog
- **THEN** the stage options update to the newly selected product's owned stages
- **AND** the previous stage selection is cleared

### Requirement: Item and risk stage errors follow the current parent

Changing the parent in an item or risk editor MUST clear the stage-validation
error produced for the previous parent and reset its selected stages. It MUST
preserve unrelated prose errors and unsaved text. The next save MUST validate
the currently selected parent under the existing product/activity rules.

#### Scenario: A single-stage product replaces a failed multi-stage selection

- **WHEN** an item or risk save fails because no stage was selected for a
  multi-stage product and the user switches to a single-stage product
- **THEN** the old stage error disappears and the new stage is applied automatically
- **AND** saving valid prose emits the new product and its single stage

#### Scenario: Parent changes preserve unrelated validation

- **WHEN** an item or risk has both prose and stage errors and its parent changes
- **THEN** only the previous parent's stage error is cleared
- **AND** unrelated prose errors remain until their fields are corrected

#### Scenario: Returning to a multi-stage product validates its new selection

- **WHEN** the user switches back to a multi-stage product and saves without
  selecting a stage
- **THEN** saving is rejected with the current missing-stage error

### Requirement: Record creation MUST use an editable Product-stage default from this draft

Lead Report Item, Risk, and Decision creation MUST pre-select the last saved eligible singleton stage for that Product in this draft. Only a successful Save of exactly one stage advances it; Cancel, a failed Save, or a deliberate multi-select leaves the previous default. The memory MUST survive an editor remount and MUST end on reload or a draft or report change. The default MUST be editable, MUST never select all owned stages, and MUST yield to explicit prefill and stored edit stages.

#### Scenario: opening Add item uses a known stage for this Product and draft

- **GIVEN** the draft's remembered stage for a multi-stage Product is Development
- **WHEN** the lead opens Add item for that Product
- **THEN** Development alone is visibly selected
- **AND** the lead can change or remove it before Save
- **AND** assigning the Product does not select its other stages

#### Scenario: opening Add item shows no stage checked

- **WHEN** Add item opens for a multi-stage Product without a remembered stage or explicit prefill
- **THEN** no stage is selected
- **AND** saving without a stage is blocked with `Select at least one stage.`

#### Scenario: opening Add decision shows no stage checked

- **WHEN** Add decision opens for a multi-stage Product without a remembered stage or explicit prefill
- **THEN** no stage is selected and a stage-less save is blocked

#### Scenario: editing restores the saved stages

- **WHEN** an existing Item, Risk, or Decision opens in edit mode
- **THEN** its saved stages are restored without substitution by a draft default
- **AND** the selector remains multi-select

#### Scenario: risk creation uses the same editable draft default

- **WHEN** Add risk opens without an explicit prefill and this Product has a remembered stage in this draft
- **THEN** only that stage is selected and the lead can revise it
- **AND** several stages may be selected deliberately, never merely because they are assigned

#### Scenario: a single owned stage still needs no extra click

- **WHEN** record creation selects a Product with exactly one owned stage
- **THEN** that stage auto-applies visibly without another click

#### Scenario: a default is cleared rather than treated as all stages

- **WHEN** the lead clears the default on a multi-stage Product and saves without another selection
- **THEN** saving is blocked with `Select at least one stage.`
- **AND** emptiness is not expanded to all stages

#### Scenario: a successful save advances the remembered stage

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead saves an Item, Risk, or Decision for that Product with Testing as its only stage and the save succeeds
- **THEN** Testing becomes the remembered stage for that Product in this draft
- **AND** the next create without explicit prefill pre-selects Testing alone

#### Scenario: Cancel keeps the previous default

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead changes the stage to Testing in an open editor and cancels without saving
- **THEN** Development remains the remembered stage
- **AND** the next create without explicit prefill still pre-selects Development alone

#### Scenario: a failed save keeps the previous default

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead changes the stage to Testing and the Save is rejected by validation or fails to persist
- **THEN** Development remains the remembered stage
- **AND** the next create without explicit prefill still pre-selects Development alone

#### Scenario: a multi-stage save keeps the previous singleton

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead saves the record with a deliberate multi-select of Development and Testing
- **THEN** the saved record stores both stages
- **AND** Development remains the remembered stage and the next create pre-selects it alone
- **AND** neither the multi-select nor an all-stage selection becomes a default
- **AND** the saved array order does not make either stage a default

#### Scenario: a multi-stage save does not invent a default

- **WHEN** the lead saves a record for a multi-stage Product with a deliberate multi-select while no stage was remembered
- **THEN** the saved record stores both stages
- **AND** no stage becomes the remembered default
- **AND** the next create starts empty

#### Scenario: the remembered stage survives an editor remount

- **GIVEN** Testing is the remembered stage for a multi-stage Product in this draft
- **WHEN** the editor remounts or closes and reopens without a page reload, draft change, or report change
- **THEN** Testing is still the remembered stage
- **AND** the next create still pre-selects Testing alone

#### Scenario: a reload or a draft or report change forgets the remembered stage

- **GIVEN** Testing is the remembered stage for a multi-stage Product in a draft
- **WHEN** the page reloads, or the lead opens another draft or report
- **THEN** no remembered stage is restored
- **AND** a create for a multi-stage Product starts empty and a sole owned stage still auto-applies
- **AND** no sessionStorage, cookie, server preference, or other persistence restores the old stage

#### Scenario: a remembered stage that is no longer available is not selected

- **GIVEN** Testing was the remembered stage for a Product in this draft
- **WHEN** Testing is no longer owned or available to the lead for that Product
- **THEN** Testing is not pre-selected
- **AND** a create starts empty when the Product has multiple owned stages, or auto-applies its sole remaining owned stage
- **AND** an ineligible remembered stage is never emitted in a save

#### Scenario: defaults cannot cross a draft or Product boundary

- **WHEN** creation opens for another Product or lead-section/report draft without a remembered stage of its own
- **THEN** the previous scope's remembered stage is not selected
- **AND** unowned or unavailable remembered stages cannot be emitted in a save

#### Scenario: a contextual prefill overrides the remembered default

- **GIVEN** Development is remembered and the risk opener explicitly supplies Testing for this Product
- **WHEN** Add risk opens
- **THEN** Testing alone is selected, not Development

#### Scenario: changing parent retains existing reset rules

- **WHEN** the lead changes Product or switches to an Activity in an open editor
- **THEN** the previous parent's stage selection is cleared and options follow the new parent
- **AND** Activity parents have no stages while a sole owned Product stage still auto-applies

### Requirement: Section writes validate stage ownership of new and changed stages

A section write MUST reject an item, risk or decision that carries a stage the
section author does not own on its product, unless the record keeps its stored
stable lineage and product and carries no stage beyond its stored stages. Such
a record MUST NOT be rejected because a stored stage is no longer owned; its
other fields may change. A record without stable lineage MUST be validated.
Stored stages MUST NOT be intersected with or rewritten to the author's current
ownership.

#### Scenario: A record keeps a stage the author lost

- **WHEN** an admin removed the author's stage and the author saves the
  section with that record's stages unchanged while editing another record
- **THEN** the save succeeds and the record keeps its stored stage

#### Scenario: A record with a lost stage gets new text

- **WHEN** the author edits the text of a record whose stored stage they no
  longer own and keeps its lineage, product and stages
- **THEN** the save succeeds with the new text

#### Scenario: A reused lineage brings a stage or product it did not store

- **WHEN** a payload record reuses a stored `stableId` but adds a stage that is
  not among its stored stages, including in place of a repeated stored stage,
  or moves to a product where the author owns no such stage
- **THEN** the write is rejected with `STAGE_NOT_OWNED`

### Requirement: A readOnly-window raise signal never prefills a later create dialog

A chip/pill raise signal (`addPrefill`) that arrives while the risk section is
`readOnly` MUST be consumed without caching its stage/severity prefill and
without opening the dialog, so a later plain +Add in editable mode still opens
with no SDLC stage pre-selected per the no-pre-select rule. The readOnly
no-dialog guard and one-shot signal semantics are unchanged.

#### Scenario: A raise signal arrives while the section is read-only

- **WHEN** a fresh raise signal with a `blocked` severity arrives while
  `readOnly` is true
- **THEN** no dialog opens
- **AND** a subsequent plain +Add after returning to editable opens the
  create form with the default (`at-risk`) severity, not the signal's

### Requirement: A locked risk card does not show the action-implying stage nudge

A risk card that offers no edit affordance (read-only section or foreign row
rendering `LockBadge`) MUST NOT show the "Select at least one stage" nudge,
since the viewer cannot act on it. Editable product-parented rows keep the
nudge under the existing stage-required rule.

#### Scenario: A stage-less foreign card on a flagged product

- **WHEN** a foreign risk with no stages renders against an at-risk or
  blocked linked product
- **THEN** no stage nudge is shown
- **AND** the foreign lock disclosure remains visible

### Requirement: Decision stage validation follows the current parent

The Decision edit dialog MUST clear a prior stage-selection error when the lead changes its parent. Required-stage validation MUST continue to apply to the current product, including implicit selection of its sole owned stage.

#### Scenario: A singleton-stage product replaces an invalid multi-stage selection

- **GIVEN** saving a decision on a multi-stage product with no selected stage displayed a stage error
- **WHEN** the lead selects an activity and then a product with exactly one owned stage
- **THEN** the sole stage is applied automatically
- **AND** the stage selector no longer displays the prior error or invalid state before another save
