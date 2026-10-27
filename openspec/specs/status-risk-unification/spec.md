## Purpose

Risk rows are the single source of truth for at-risk/blocked states on the lead report: covering risks floor stage chips at render, own coverage counts toward own-input completeness without foreign or stage-less inflation, a chip is a plain On Track/unset toggle that cannot author or change a covered severity, and it governs the risk-entry dialog's stage defaults.

## Requirements

### Requirement: Risks are the single source of truth for at-risk/blocked

At-risk and blocked states MUST be authored only as risk rows in the Risks section. Stage chips (`SdlcPipeline` in `apps/web/src/features/period/ui/sdlc-pipeline.tsx`) MUST NOT author an at-risk/blocked state: a chip has no status menu, offers no At risk/Blocked option, and an editable chip is a plain toggle between unset (empty) and On Track. A covering risk floors the chip's DISPLAYED severity at render, and while it exists the chip MUST NOT be set to On Track — a click leaves the status unchanged and directs the lead to resolve the risk in the Risks section. Removing every covering risk returns the chip to its stored On Track or unset status.

#### Scenario: a chip click toggles On Track, never a severity

- **WHEN** the lead clicks an editable, uncovered stage chip
- **THEN** the chip toggles between unset and On Track only
- **AND** no status menu is shown and no at-risk/blocked option exists

#### Scenario: a covered chip cannot be set on-track from the chip

- **WHEN** the lead clicks a stage chip that a covering risk floors to at-risk or blocked
- **THEN** the status is unchanged and the lead is sent to resolve the risk in the Risks section

#### Scenario: removing the covering risk un-floors the chip

- **GIVEN** a chip floored to blocked by one covering risk
- **WHEN** the lead deletes that risk in the Risks section
- **THEN** the chip returns to its stored On Track or unset status without chip interaction

### Requirement: Covering risks force a severity floor on stage chips

A stage chip, AS DISPLAYED, MUST render at least the highest covering risk's severity when its stage is covered by at least one non-empty own risk (precedence: blocked > at-risk), and MUST NOT show on-track or empty while covering risks exist. The floor applies at RENDER time in the live lead form (`applyRiskSeverityFloor` in `lead-form-sync-bridge.tsx`) and the slides/head-review surface (`floorSlideStageStatus` in `section-slide-product-projection.ts`), both through the shared `deriveEffectiveStageStatus`. It MUST also COLLAPSE a stale unbacked severity: a raw at-risk/blocked stage with NO covering risk MUST render On Track on the live form; `applyRiskSeverityFloor` MUST route every own stage through `deriveEffectiveStageStatus` (not only stages with a covering risk), so the live form and read model never disagree on an orphan explicit severity. The RAW read-model status is a separate layer: `mapLeadProducts` in `apps/web/src/features/report-sections/model/lead-form.ts` floors a NON-EMPTY stage (up to a worse risk, collapsing a stale unbacked severity) through `deriveEffectiveStageStatus` but PRESERVES an EMPTY stage's raw status (the empty→empty guard) and records coverage via `coveredByOwnRisk` for the completeness counter.

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

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The Lead Report risk-entry dialog MUST NOT default to all owned stages on a multi-stage Product. An originating-stage prefill MUST select only that stage. Otherwise creation MUST follow the editable draft-default contract in `risk-stage-integrity` (advance, singleton, draft lifetime). Product changes MUST reset selection rather than select all stages; deliberate multi-stage coverage MUST remain available.

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
- **AND** required text, Impact, Mitigation, and severity keep their existing contracts

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
- **THEN** only stage initialization changes; required Impact, Mitigation and explicit severity keep their validation contracts
- **AND** severity and render-floor derivation follow their existing contracts
- **AND** stage ownership and server `safeText` remain enforced

### Requirement: The project-level flagged-red escalation is emitted once per red product

The shared Blocked-&-At-Risk builder (`buildEscalationsFromReadSections` in `packages/shared/src/schemas/report/report-escalations.ts`) MUST emit the project-level "flagged red" escalation exactly once per red product, regardless of co-owner count: the product-scoped signal MUST NOT be emitted per lead. De-duplication MUST happen in that builder (single source for live and published surfaces), keyed by `projectId` across the whole section loop (not per section); the survivor MUST retain a deterministic contributing `leadName` (the `Escalation` schema requires it), and collapsing duplicates MUST NOT change published correctness. This de-duplication MUST apply ONLY to flagged red: per-item `blocked` and per-risk `unresolved_risk` escalations are per-record and, for PRODUCT-parented records, MUST remain unchanged in count and content. Every PRODUCT-parented `blocked` or `unresolved_risk` escalation MUST carry a non-empty `stageName`; only the product-level `at_risk` roll-up may have a null `stageName`, the contract MUST reject a missing or empty stage on the two stage-keyed types, and consumers MUST NOT synthesize placeholder labels. Activity-parented records (an `Item` or `Risk` whose product FK is null and whose `activityId` is set) MUST NOT feed the table: the builder MUST skip null-`projectId` records, so an activity's blocked item or unresolved risk emits no `blocked`, `unresolved_risk` or flagged-red escalation and never inflates a linked product's roll-up.

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

### Requirement: Item cards derive at-risk/blocked from covering risks

An item's at-risk/blocked alarm MUST be derived from a covering risk row, never set as a free workflow choice, exactly as the stage chip is — the item card is a governed surface under the single-source-of-truth rule. This extends "Risks are the single source of truth for at-risk/blocked" from the stage chip (`SdlcPipeline`) to the item card (`apps/web/src/features/report-sections/ui/item-card.tsx`); the detailed derivation, locked-alarm UX, blocker-creation routing and stored representation live in `record-status-derivation`; this requirement keeps the two surfaces from drifting.

#### Scenario: an item card never authors an unbacked alarm

- **GIVEN** an item with no covering risk row
- **WHEN** the lead attempts to set it to at-risk or blocked
- **THEN** the alarm is not stored on the item directly
- **AND** the gesture routes through blocker creation, mirroring the stage chip

#### Scenario: a covered item card is floored to the covering severity

- **GIVEN** an item whose product and stage are covered by an own blocked risk
- **WHEN** the item card renders
- **THEN** the item pill shows Blocked, floored from the covering risk
- **AND** the alarm cannot be cleared without resolving the covering risk

### Requirement: Unset stages auto-promote to On Track at submit after a warning

In the browser lead form, any own stage left unset (empty) MUST be promoted to On Track in the payload from `buildLeadSubmitPayload`, mirroring its null→green coercion for project and activity statuses; the submit-confirm dialog MUST warn first with how many stages will be marked On Track, and this client promotion MUST NOT block submit. While editing, an unset stage remains valid. The server `reports.submit` MUST require a non-null traffic light for every stage in its authoritative section projects' ownedStages, matched by both `projectId` and `stageId`; for duplicate pairs the effective last entry MUST satisfy completeness, and a missing entry, omitted status, or null status MUST be rejected with `MISSING_TRAFFIC_LIGHT` before saving, and the section MUST remain unchanged. The server MUST NOT promote missing statuses; borrowed or unowned stages and referenced products MUST NOT add completeness requirements; explicit red, yellow, and green statuses MUST remain admissible when the other submission requirements are met; draft saves MUST still allow unset stages.

#### Scenario: the submit-confirm dialog warns about unset stages

- **GIVEN** a section with two own stages left unset
- **WHEN** the lead opens the submit confirmation
- **THEN** the dialog states 2 stages are not set and will be marked On Track

#### Scenario: confirming submit promotes unset stages to On Track

- **WHEN** the lead confirms submit with unset own stages
- **THEN** those stages are submitted as On Track and submit proceeds

#### Scenario: no unset stages shows no warning

- **GIVEN** a section where every own stage has a status
- **WHEN** the lead opens the submit confirmation
- **THEN** no unset-stage warning is shown

#### Scenario: direct submit omits an owned stage status

- **GIVEN** a draft section with an assigned owned stage
- **WHEN** `reports.submit` receives no matching stage-status entry, or an omitted or null status
- **THEN** it returns `MISSING_TRAFFIC_LIGHT` identifying the product and stage
- **AND** no section save occurs and the persisted draft remains unchanged

#### Scenario: another product has the same stage identifier

- **GIVEN** two assigned products carry the same owned stage identifier
- **WHEN** the payload supplies that identifier's status for only one product
- **THEN** the other product's stage is rejected as missing with `MISSING_TRAFFIC_LIGHT`

#### Scenario: complete owned-stage statuses are submitted

- **WHEN** every owned stage has an explicit red, yellow or green status and other submit requirements are met
- **THEN** `reports.submit` proceeds without server promotion

#### Scenario: borrowed stages do not expand completeness

- **GIVEN** all own stages have explicit statuses and a borrowed or referenced stage is unset
- **WHEN** the lead submits a payload satisfying the other requirements
- **THEN** the borrowed or referenced stage produces no completeness error

#### Scenario: duplicate owned-stage entries have an unset final value

- **WHEN** a payload duplicates entries for one owned project/stage pair and the last is null or omitted
- **THEN** `reports.submit` rejects that stage with `MISSING_TRAFFIC_LIGHT`
- **AND** an explicit final red, yellow or green remains admissible when the other requirements are met

### Requirement: Severity ranking and the risk floor mapping have one shared core

The system MUST derive every severity worst-of fold and every risk-severity-to-status floor from one shared core in `packages/shared` (`CanonicalStatus` ladder, `worstCanonicalStatus`, `riskSeverityToCanonicalFloor`, and the canonical↔traffic-light adapters); web and API code MUST NOT keep a private precedence table, worst-of fold, or severity→floor mapping.

#### Scenario: One rule change propagates to every surface

- **WHEN** the risk-severity floor mapping changes in the shared core
- **THEN** the lead form, read-model derivation and published snapshot reflect the new mapping with no further edit
- **AND** no file outside `packages/shared` declares a severity precedence table

#### Scenario: Web collapse-down semantics survive the dedup

- **WHEN** a stage carries a manual at-risk/blocked status with no covering risk or blocked item
- **THEN** `deriveEffectiveStageStatus` still collapses it to on-track
- **AND** the shared core carries no collapse-down branch

#### Scenario: Vocabulary adapters agree

- **WHEN** the same risk/item inputs run through the canonical and traffic-light adapters
- **THEN** the results correspond under `canonicalToTrafficLight`

### Requirement: Risk severity is a required contract field

Every risk MUST carry an explicit severity (`at-risk` or `blocked`) through the whole stack — Zod contract, Prisma column without a default, read models, and the shared floor mapping — and no derivation path may carry a branch for an absent severity.

#### Scenario: The contract rejects a severity-less risk

- **WHEN** a risk payload without `severity` reaches the write contract
- **THEN** validation fails loud before persistence
- **AND** the Prisma column declares no default to absorb it

#### Scenario: Floor derivations consume explicit severity only

- **WHEN** `riskSeverityToCanonicalFloor` and its callers are inspected
- **THEN** the floor maps exactly `blocked → blocked` and `at-risk → at-risk`
- **AND** no caller filters or coerces an undefined severity

### Requirement: Slide readiness derives project severity from the unified slide status model

The section-slide readiness model MUST count a real project as blocked or at-risk from the risk-derived product status of that project's section slide badge, before any cross-author foreign health adjustment, and MUST NOT derive project severity from persisted `ReportSectionReadModel.projects[].trafficLight`. Synthetic cross-product slides MUST NOT contribute a project severity count; project-scoped risk-row counts remain additive and MUST keep contributing independently.

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
