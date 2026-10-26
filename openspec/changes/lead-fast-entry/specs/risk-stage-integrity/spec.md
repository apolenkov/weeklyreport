## RENAMED Requirements

- FROM: `### Requirement: Record dialogs do not pre-select stages on create`
- TO: `### Requirement: Record dialogs use editable draft-scoped stage defaults on create`

## MODIFIED Requirements

### Requirement: Record dialogs use editable draft-scoped stage defaults on create

The Lead Report Item, Risk, and Decision create editors MUST pre-select the last chosen stage for the selected Product in the same lead section draft when it remains an owned option. That default MUST be visibly selected and editable, never an automatic selection of all owned stages. With no eligible remembered choice, multi-stage Products MUST start empty and retain the existing required-stage validation. Exactly one owned stage MUST still auto-apply. Explicit contextual stage prefill MUST take precedence over the remembered default. Edit mode MUST restore the record's stored `stageNames`, not substitute a default. Stage selection MUST remain multi-select, so deliberate multi-stage coverage is still possible. Product changes MUST still clear the previous selection; Activity parents MUST have no stage. Draft defaults MUST NOT leak to another Product, lead section, or report draft.

#### Scenario: opening Add item shows no stage checked

- **WHEN** a lead opens Add item on a Product with two or more owned stages and no eligible remembered choice or contextual prefill
- **THEN** no stage is pre-selected
- **AND** saving without choosing a stage is blocked with `Select at least one stage.`

#### Scenario: opening Add item uses a known stage for this Product and draft

- **GIVEN** the lead last chose Development for a Product with multiple owned stages in this draft
- **WHEN** the lead opens Add item for that Product
- **THEN** only Development is pre-selected and visibly indicated
- **AND** the lead can change or remove it before saving
- **AND** no other owned stage is selected merely because it is assigned

#### Scenario: opening Add decision shows no stage checked

- **WHEN** a lead opens Add decision for a Product with two or more owned stages and no eligible remembered choice in this draft
- **THEN** no stage is pre-selected
- **AND** saving without a stage is blocked with `Select at least one stage.`

#### Scenario: editing restores the saved stages

- **WHEN** a lead opens an existing item, risk, or decision in edit mode
- **THEN** the stages stored on that record are shown selected
- **AND** a remembered default does not replace them

#### Scenario: risk creation uses the same editable draft default

- **GIVEN** a Product has two or more owned stages and one eligible last chosen stage in this draft
- **WHEN** the lead opens Add risk without an explicit stage prefill
- **THEN** only that last chosen stage is visibly selected
- **AND** the lead can revise it, including deliberately choosing several stages

#### Scenario: a single owned stage still needs no extra click

- **WHEN** an Item, Risk, or Decision create editor selects a Product with exactly one owned stage
- **THEN** that stage applies automatically and remains visible to the lead
- **AND** the editor does not ask for another stage click before saving valid content

#### Scenario: a default is cleared rather than treated as all stages

- **WHEN** the lead removes a pre-selected stage from a multi-stage Product and saves without choosing another
- **THEN** saving is blocked with `Select at least one stage.`
- **AND** no empty selection is expanded into all owned stages

#### Scenario: defaults cannot cross a draft or Product boundary

- **WHEN** a create editor opens for another Product or another lead section/report draft without an eligible choice of its own
- **THEN** the previous Product/draft's remembered stage is not selected
- **AND** an unowned or no-longer-available remembered stage is not emitted in a save payload

#### Scenario: a contextual prefill overrides the remembered default

- **GIVEN** the remembered stage is Development and a risk opener explicitly supplies Testing for the same Product
- **WHEN** the create dialog opens
- **THEN** only the originating Testing stage is pre-selected, not the remembered Development stage

#### Scenario: changing parent retains existing reset rules

- **WHEN** the lead changes Product or switches to an Activity in an open record editor
- **THEN** the previous parent's stage selection is cleared and options follow the new parent
- **AND** an Activity has no selected stages, while a sole owned Product stage still auto-applies

Code anchors at baseline `99d3651f2`: [single-stage helper](../../../../../apps/web/src/features/report-sections/model/stage-ownership.ts#L6-L15), [item stage seed](../../../../../apps/web/src/features/report-sections/ui/item-edit-draft-store.ts#L43-L60), [risk seed](../../../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L69-L73), [risk parent reset](../../../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L173-L183), [decision effective selection](../../../../../apps/web/src/features/period/ui/decision-edit-dialog-model.ts#L70-L87). Multi-stage draft memory is proposed, not present in these owners yet. The renamed requirement replaces the unconditional empty-on-create rule; the other stage-validation and parent-reset requirements are unchanged.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic. Product-stage requirements, Activity stage prohibition, required pause reason, risk Impact/Mitigation, and server `safeText` are not relaxed.
