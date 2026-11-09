## MODIFIED Requirements

### Requirement: Covering risks force a severity floor on stage chips

A stage chip, AS DISPLAYED, MUST render at least the highest covering risk's severity when its stage is covered by at least one non-empty own risk (precedence: blocked > at-risk), and MUST NOT show on-track or empty while covering risks exist. The floor applies at RENDER time in the live lead form (`applyRiskSeverityFloor` in `lead-form-sync-bridge.tsx`) and the slides/head-review surface (`floorSlideStageStatus` in `section-slide-product-projection.ts`), both through the shared `deriveEffectiveStageStatus`. It MUST also COLLAPSE a stale unbacked severity: a raw at-risk/blocked stage with NO covering risk MUST render On Track on the live form; `applyRiskSeverityFloor` MUST route every own stage through `deriveEffectiveStageStatus` (not only stages with a covering risk), so the live form and read model never disagree on an orphan explicit severity. The RAW read-model status is a separate layer: `mapLeadProducts` in `apps/web/src/features/report-sections/model/lead-form.ts` floors a NON-EMPTY stage (up to a worse risk, collapsing a stale unbacked severity) through `deriveEffectiveStageStatus` but PRESERVES an EMPTY stage's raw status (the empty→empty guard) and records coverage via `coveredByOwnRisk` for the completeness counter.

For this floor and coverage annotation, a covering risk MUST be complete. Incomplete risks remain visible as incomplete to their authorized author but MUST NOT floor either the author-private form or reviewer-facing projections; scoped omission disclosure is separate from status and does not imply that no risk exists.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked covering the
  Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra confirmation

#### Scenario: an orphan explicit severity collapses on the live form

- **WHEN** a draft loads with a persisted explicit blocked stage status and no covering risk
- **THEN** the chip renders On Track on the live form, matching the read model, with no interaction to correct it

#### Scenario: the read-model mapper preserves raw status and annotates coverage

- **WHEN** the read-model mapper builds a product whose stage has an empty status but a non-empty covering own risk
- **THEN** the mapper keeps the stage's raw status empty and sets `coveredByOwnRisk` to true (not floored)
- **AND** the live form and slides/head-review re-floor the chip to the risk severity at render

#### Scenario: incomplete blocked risk cannot floor a stage

- **WHEN** an incomplete blocked risk covers a stage and no complete risk covers it
- **THEN** neither author-private nor reviewer-facing stage status is floored by that draft
- **AND** the author sees the draft marked incomplete and scoped reviewers see an omission indication without draft text

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The Lead Report risk-entry dialog MUST NOT default to all owned stages on a multi-stage Product. An originating-stage prefill MUST select only that stage. Otherwise creation MUST follow the editable draft-default contract in `risk-stage-integrity` (advance, singleton, draft lifetime). Product changes MUST reset selection rather than select all stages; deliberate multi-stage coverage MUST remain available.

Draft save accepts missing Impact and Mitigation as null when valid primary text, eligible context and explicit severity are present; section submission still requires both details. No text or context is invented.

#### Scenario: opening the dialog with a prefilled stage selects only that stage

- **WHEN** the lead opens the risk-entry dialog from an item's alarm gesture, which prefills one stage
- **THEN** the stage multi-select has only that stage checked
- **AND** the other owned stages are unchecked even if another is remembered in this draft

#### Scenario: switching product does not auto-select all owned stages

- **WHEN** the lead changes the Product in the open risk dialog
- **THEN** the previous selection is cleared and options follow the new Product
- **AND** the multi-select does not auto-check every owned stage on a multi-stage Product
- **AND** the existing sole-owned-stage shortcut still applies

#### Scenario: a remembered draft choice is a correctable risk default

- **GIVEN** this Product has multiple owned stages and this draft remembers Development
- **WHEN** the lead opens a new risk without an originating-stage prefill
- **THEN** Development alone is visibly selected and changeable before Save
- **AND** primary text and explicit severity remain required; Impact and Mitigation may be null on draft save but are required at section submit

#### Scenario: a successful risk save advances the remembered default

- **GIVEN** Development is remembered for a multi-stage Product in this draft
- **WHEN** the lead saves a new risk for that Product with Testing as its only stage and the save succeeds
- **THEN** Testing becomes remembered and the next risk create pre-selects it alone
- **AND** the same memory feeds item and decision creation for that Product in this draft

#### Scenario: cancelling or a failed risk save keeps the previous default

- **GIVEN** Development is remembered for a multi-stage Product in this draft
- **WHEN** the lead switches the risk stage to Testing and cancels, or the Save is rejected or fails
- **THEN** Development remains remembered
- **AND** the next risk create still pre-selects Development alone

#### Scenario: a deliberate multi-stage risk save keeps the previous singleton

- **GIVEN** Development is remembered for a multi-stage Product in this draft
- **WHEN** the lead saves a risk covering Development and Testing deliberately
- **THEN** the risk stores both stages and reopens with both selected
- **AND** Development stays remembered and the next risk create pre-selects it alone
- **AND** neither multi-select nor all-stages becomes a default

#### Scenario: no eligible draft default exists

- **WHEN** Add risk opens for a multi-stage Product with no eligible remembered stage and no prefill
- **THEN** no stage is selected
- **AND** saving requires an explicit concrete stage; emptiness is never all stages

#### Scenario: stage convenience does not change risk derivation

- **WHEN** a risk uses a remembered stage, a sole-owned-stage fallback, or explicit originating-stage prefill
- **THEN** only stage initialization changes; Impact and Mitigation may be null on draft save but remain required at section submit, and explicit severity remains required
- **AND** severity and render-floor derivation follow their existing contracts
- **AND** stage ownership and server `safeText` remain enforced

#### Scenario: minimal risk draft keeps honest missing details

- **WHEN** the author saves valid risk text with an eligible parent and stage and explicit severity but no Impact or Mitigation
- **THEN** the confirmed draft stores those details as null and identifies itself as incomplete
- **AND** section submit requires completion or explicit deletion

### Requirement: The project-level flagged-red escalation is emitted once per red product

The shared Blocked-&-At-Risk builder (`buildEscalationsFromReadSections` in `packages/shared/src/schemas/report/report-escalations.ts`) MUST emit the project-level "flagged red" escalation exactly once per red product, regardless of co-owner count: the product-scoped signal MUST NOT be emitted per lead. De-duplication MUST happen in that builder (single source for live and published surfaces), keyed by `projectId` across the whole section loop (not per section); the survivor MUST retain a deterministic contributing `leadName` (the `Escalation` schema requires it), and collapsing duplicates MUST NOT change published correctness. This de-duplication MUST apply ONLY to flagged red: per-item `blocked` and per-risk `unresolved_risk` escalations are per-record and, for PRODUCT-parented records, MUST remain unchanged in count and content. Every PRODUCT-parented `blocked` or `unresolved_risk` escalation MUST carry a non-empty `stageName`; only the product-level `at_risk` roll-up may have a null `stageName`, the contract MUST reject a missing or empty stage on the two stage-keyed types, and consumers MUST NOT synthesize placeholder labels. Activity-parented records (an `Item` or `Risk` whose product FK is null and whose `activityId` is set) MUST NOT feed the table: the builder MUST skip null-`projectId` records, so an activity's blocked item or unresolved risk emits no `blocked`, `unresolved_risk` or flagged-red escalation and never inflates a linked product's roll-up.

Reviewer-facing and published builder inputs MUST exclude incomplete risks before product status and escalations are derived. Scoped omission counts are disclosed separately and do not assert an absence of risk; complete records retain their existing behavior.

#### Scenario: a red product co-owned by multiple leads

- **WHEN** the builder runs over sections where the same product is flagged red and co-owned by two or more leads
- **THEN** exactly one flagged-red (`at_risk`, product-level) escalation is emitted for it
- **AND** it carries a deterministic contributing lead's non-empty `leadName`

#### Scenario: item and risk escalations are unaffected by the dedupe

- **WHEN** the builder runs over sections with PRODUCT-parented `blocked` items and unresolved risks alongside a multi-co-owner red product
- **THEN** per-item `blocked` and per-risk `unresolved_risk` escalations are emitted unchanged in count and content
- **AND** only duplicate project-level flagged-red rows collapse

#### Scenario: an activity-parented blocked item emits no escalation

- **GIVEN** a section whose only blocked item and unresolved risk are activity-parented (product FK null, `activityId` set)
- **WHEN** `buildEscalationsFromReadSections` runs
- **THEN** no per-item `blocked`, per-risk `unresolved_risk` or flagged-red escalation is emitted for them

#### Scenario: the live and published surfaces stay in parity

- **WHEN** the same sections reach the builder on the live dashboard and published-snapshot paths
- **THEN** both surfaces receive the same single flagged-red escalation per red product
- **AND** neither surface renders duplicate flagged-red rows that differ only by
  assignee

#### Scenario: incomplete risk cannot create a reviewer escalation

- **WHEN** a product has only an incomplete blocked risk in an unsubmitted section
- **THEN** the risk does not produce a flagged-red or unresolved-risk escalation in reviewer or published output
- **AND** scoped omission disclosure is separate

### Requirement: Slide readiness derives project severity from the unified slide status model

The section-slide readiness model MUST count a real project as blocked or at-risk from the risk-derived product status of that project's section slide badge, before any cross-author foreign health adjustment, and MUST NOT derive project severity from persisted `ReportSectionReadModel.projects[].trafficLight`. Synthetic cross-product slides MUST NOT contribute a project severity count; project-scoped risk-row counts remain additive and MUST keep contributing independently.

Incomplete risks MUST be excluded before reviewer-facing readiness, product severity and risk-row counts are derived; scoped omission disclosure remains separate. Author-private drafts remain visible to their authorized author and do not floor these statuses.

#### Scenario: Stale unbacked red does not block slide readiness

- **GIVEN** a real project whose persisted traffic light and owned-stage status are red
- **AND** the project has no backing risks
- **WHEN** the section slide model derives the product badge and readiness
- **THEN** the product badge is green
- **AND** the project contributes zero to `blockedCount` and `atRiskCount`
- **AND** the slide tone is not blocked by that stale severity
- **AND** the Risk story readiness item is optional and does not say “Explain
  the red or yellow signal”

#### Scenario: Risk-backed red remains blocked

- **GIVEN** a real project with a stage covered by one blocked project risk
- **AND** the persisted project traffic light is not red
- **WHEN** the section slide model derives the product badge and readiness
- **THEN** the product badge is red
- **AND** the derived project contributes one to `blockedCount`
- **AND** the blocked risk row keeps its independent count
- **AND** the slide tone is blocked and Risk story readiness is required

#### Scenario: Synthetic cross-product status is not a project count

- **GIVEN** a section projection containing a synthetic cross-product slide
- **WHEN** section readiness counts blocked and at-risk projects
- **THEN** only projected product ids backed by `section.projects` contribute a project count

#### Scenario: Foreign health adjusts the badge but not the project counts

- **GIVEN** a real project whose own section has no backing risks
- **AND** foreign health marks the same product red on the lead deck
- **WHEN** the section slide model derives the badge and readiness
- **THEN** the deck badge reflects the foreign-adjusted status
- **AND** the project contributes zero to `blockedCount` and `atRiskCount`
- **AND** foreign blocked risk rows still contribute exactly once as risk rows

#### Scenario: incomplete risk does not affect reviewer readiness

- **WHEN** a section contains an incomplete blocked risk and no complete risk covering the product
- **THEN** reviewer-facing readiness excludes that risk from product severity and risk-row counts
- **AND** a scoped omission indication is presented separately
