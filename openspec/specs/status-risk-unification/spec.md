## Purpose

Risk rows are the single source of truth for at-risk/blocked stage states on the
lead report. This capability governs how covering risks floor stage chips at
render, how the lead's own risk coverage counts toward own-input completeness
(without letting foreign or stage-less risks inflate it), how the chip behaves as
a plain On Track/unset toggle that cannot author or change a covered severity,
and the risk-entry dialog's stage-selection defaults.

## Requirements

### Requirement: Risks are the single source of truth for at-risk/blocked

At-risk and blocked states MUST be authored only as risk rows in the Risks
section of the lead report. Stage chips (`SdlcPipeline` in
`apps/web/src/features/period/ui/sdlc-pipeline.tsx`) MUST NOT author an
at-risk/blocked state at all: a chip has no status menu and offers no
At Risk/Blocked option. An editable chip is a plain toggle between unset (empty)
and On Track. A covering risk floors the chip's DISPLAYED severity at render;
while a covering risk exists the chip MUST NOT be settable to On Track — clicking
it leaves the status unchanged and directs the lead to resolve the risk in the
Risks section. Removing every covering risk returns the chip to its stored On
Track or unset status.

#### Scenario: a chip click toggles On Track, never a severity

- **WHEN** the lead clicks an editable, uncovered stage chip
- **THEN** the chip toggles between unset and On Track only
- **AND** no status menu is shown and no at-risk/blocked option exists

#### Scenario: a covered chip cannot be set on-track from the chip

- **WHEN** the lead clicks a stage chip that a covering risk floors to
  at-risk or blocked
- **THEN** the status is unchanged and the lead is directed to resolve the
  risk in the Risks section

#### Scenario: removing the covering risk un-floors the chip

- **GIVEN** a chip floored to blocked by a single covering risk
- **WHEN** the lead deletes that risk in the Risks section
- **THEN** the chip returns to its stored On Track or unset status without any
  chip interaction

### Requirement: Covering risks force a severity floor on stage chips

A stage chip, AS DISPLAYED, MUST render at least at the highest covering risk's
severity when its stage is covered by at least one non-empty own risk
(precedence: blocked > at-risk). The DISPLAYED chip MUST NOT show on-track or
empty while covering risks exist. This DISPLAY floor is applied at RENDER time —
by the live lead form (`applyRiskSeverityFloor` in `lead-form-sync-bridge.tsx`)
and the slides/head-review surface (`floorSlideStageStatus` in
`section-slide-product-projection.ts`), both deriving the severity through the shared
`deriveEffectiveStageStatus`.

The render floor MUST also COLLAPSE a stale unbacked severity: a stage whose raw
status is at-risk/blocked but which has NO covering risk MUST render as On Track
on the live form, matching the read-model mapper. `applyRiskSeverityFloor` MUST
route every own stage through `deriveEffectiveStageStatus` (not only stages with
a covering risk), so the live form and read model never disagree on an orphan
explicit severity. A stale explicit at-risk/blocked value therefore renders
On Track on the next load without a separate repair step.

The RAW read-model status is a SEPARATE layer from the displayed chip. The
mapper (`mapLeadProducts` in `apps/web/src/features/report-sections/model/lead-form.ts`) applies the
floor to a NON-EMPTY stage (via `deriveEffectiveStageStatus`: floor up to a worse
covering risk, collapse a stale unbacked severity down) but PRESERVES an EMPTY
stage's raw status as empty — the empty→empty guard. It records coverage
separately via the `coveredByOwnRisk` annotation for the completeness counter.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked covering the
  Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra confirmation

#### Scenario: an orphan explicit severity collapses on the live form

- **WHEN** a draft loads whose persisted explicit stage status is blocked while
  no covering risk exists
- **THEN** the chip renders On Track on the live lead form, matching the read
  model, and no chip interaction is needed to correct it

#### Scenario: the read-model mapper preserves raw status and annotates coverage

- **WHEN** the read-model mapper builds the view of a product whose stage has an
  empty status but a non-empty covering own risk
- **THEN** the mapper keeps the stage's raw status empty and sets
  `coveredByOwnRisk` to true (it does NOT floor the raw status)
- **AND** the live lead form and the slides/head-review surface re-floor the
  chip to the risk severity at render

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The risk-entry dialog stage multi-select MUST NOT default to every owned
stage checked. When the dialog opens with a prefilled stage — the item
dialog's alarm gesture passes the item's product + stage — it MUST default
the selection to that prefilled stage only. Switching the product through the
dialog's `onParentChange` boundary, backed by `setParentAndStages`, MUST NOT
auto-select all of the newly-owned stages; it MUST clear the selection or keep
only the originating stage. A risk MAY still deliberately cover several
stages, but multi-stage coverage MUST be a deliberate choice, never the
default.

#### Scenario: opening the dialog with a prefilled stage selects only that stage

- **WHEN** the lead opens the risk-entry dialog from an item's alarm gesture,
  which prefills a single stage
- **THEN** the stage multi-select has only the prefilled stage checked
- **AND** the other owned stages are unchecked

#### Scenario: switching product does not auto-select all owned stages

- **WHEN** the lead changes the product in the open risk dialog
- **THEN** the stage multi-select does not auto-check every stage owned
  on the new product
- **AND** the selection is cleared or keeps only the originating stage

### Requirement: The project-level flagged-red escalation is emitted once per red product

The shared Blocked-&-At-Risk builder MUST emit the project-level "flagged red"
escalation exactly once per red product, regardless of how many leads co-own
that product. The builder is `buildEscalationsFromReadSections` in
`packages/report-persistence/src/published-report-snapshot.ts`. The product-level red
signal is product-scoped (it is derived from the product's effective status, not
from any single lead's contribution), so it MUST NOT be emitted once per
contributing lead's section.

De-duplication MUST happen in the builder (the single shared source for both the
live dashboard and the published-report snapshot), keyed by `projectId`, and
tracked across the whole section loop (not per section). The surviving
escalation MUST retain a deterministic contributing lead's `leadName` (the
`Escalation` schema requires a non-empty `leadName`); collapsing the duplicates
MUST NOT change the published report's correctness — the flagged-red row's
content does not depend on which owner is retained.

This de-duplication MUST apply ONLY to the project-level flagged-red escalation.
The per-item `blocked` escalations and the per-risk `unresolved_risk`
escalations are genuinely per-record and, for PRODUCT-parented records, MUST
remain unchanged in both count and content.

Every PRODUCT-parented `blocked` or `unresolved_risk` escalation MUST carry a
non-empty `stageName`. Only the product-level `at_risk` roll-up may have a null
`stageName`, because it represents the product flag rather than a concrete
stage. The shared escalation contract MUST reject a missing or empty stage on
the two stage-keyed escalation types; consumers MUST NOT synthesize a
placeholder stage label.

Activity-parented records — an `Item` or `Risk` whose product FK is null and
whose `activityId` is set — MUST NOT feed the escalation table. The
builder is keyed on `projectId`, so it MUST skip null-`projectId` records: an
activity's blocked item or unresolved risk emits NO per-item `blocked`, per-risk
`unresolved_risk`, or product-level flagged-red escalation, and it never inflates
a linked product's roll-up. Activity escalation parity is not part of the
current escalation feed; this narrowing keeps the escalation feed
product-scoped while activities become first-class on the report surfaces.

#### Scenario: a red product co-owned by multiple leads

- **WHEN** the builder runs over report sections in which the same product is
  flagged red and is co-owned by two or more leads
- **THEN** exactly one flagged-red (`at_risk`, product-level) escalation is
  emitted for that product
- **AND** it carries a deterministic contributing lead's non-empty `leadName`

#### Scenario: item and risk escalations are unaffected by the dedupe

- **WHEN** the builder runs over sections that include PRODUCT-parented `blocked`
  items and unresolved risks alongside a multi-co-owner red product
- **THEN** the per-item `blocked` escalations and the per-risk
  `unresolved_risk` escalations are emitted unchanged in count and content
- **AND** only the duplicate project-level flagged-red rows are collapsed

#### Scenario: an activity-parented blocked item emits no escalation

- **GIVEN** a section whose only blocked item and unresolved risk are parented to
  an activity (product FK null, `activityId` set)
- **WHEN** `buildEscalationsFromReadSections` runs
- **THEN** no per-item `blocked`, per-risk `unresolved_risk`, or product-level
  flagged-red escalation is emitted for those activity records

#### Scenario: the live and published surfaces stay in parity

- **WHEN** the same report sections are passed to the builder on the live
  dashboard path and on the published-report snapshot path
- **THEN** both surfaces receive the same single flagged-red escalation per red
  product
- **AND** neither surface renders duplicate flagged-red rows that differ only by
  assignee

### Requirement: Item cards derive at-risk/blocked from covering risks

An item's at-risk/blocked alarm MUST be derived from a covering risk row, never
set as a free workflow choice, exactly as the stage chip is — the item card is a
governed surface under the single-source-of-truth rule. This extends the
"Risks are the single source of truth for at-risk/blocked" requirement from the
stage chip (`SdlcPipeline`) to the item card
(`apps/web/src/features/report-sections/ui/item-card.tsx`). The detailed derivation,
locked-alarm UX, route-through-blocker-creation, and stored-representation rules
live in the `record-status-derivation` capability; this requirement fixes the
invariant so the two surfaces cannot drift.

#### Scenario: an item card never authors an unbacked alarm

- **GIVEN** an item with no covering risk row
- **WHEN** the lead attempts to set it to at-risk or blocked
- **THEN** the alarm is not stored on the item directly
- **AND** the gesture routes through risk (blocker) creation, mirroring the stage-chip interception

#### Scenario: a covered item card is floored to the covering severity

- **GIVEN** an item whose product and stage are covered by an own risk of severity blocked
- **WHEN** the item card renders
- **THEN** the item pill shows Blocked, floored from the covering risk
- **AND** the alarm cannot be cleared from the item without resolving the covering risk

### Requirement: Unset stages auto-promote to On Track at submit after a warning

At submit, any of the lead's own stages left unset (empty) MUST be promoted to
On Track in the submitted section, mirroring the existing null→green coercion for
project and activity statuses. The submit-confirm dialog MUST warn the lead
first, stating how many stages will be marked On Track; the promotion MUST NOT
block submit. While editing (before submit) an unset stage remains a valid state.

#### Scenario: the submit-confirm dialog warns about unset stages

- **GIVEN** a section with two of the lead's own stages left unset
- **WHEN** the lead opens the submit confirmation
- **THEN** the dialog states that 2 stages are not set and will be marked On
  Track

#### Scenario: confirming submit promotes unset stages to On Track

- **WHEN** the lead confirms submit with unset own stages
- **THEN** those stages are submitted as On Track and submit proceeds

#### Scenario: no unset stages shows no warning

- **GIVEN** a section where every own stage has a status
- **WHEN** the lead opens the submit confirmation
- **THEN** no unset-stage warning is shown

### Requirement: Severity ranking and the risk floor mapping have one shared core

The system MUST derive every severity worst-of fold and every risk-severity-to-status floor from one shared core in `packages/shared` (`CanonicalStatus` ladder, `worstCanonicalStatus`, `riskSeverityToCanonicalFloor`, and the canonical↔traffic-light adapters); web and API code MUST NOT keep a private precedence table, worst-of fold, or severity→floor mapping.

#### Scenario: One rule change propagates to every surface

- **WHEN** the risk-severity floor mapping changes in the shared core
- **THEN** the live lead form, the read-model derivation, and the published snapshot all reflect the new mapping without any further edit
- **AND** no file outside `packages/shared` declares a severity precedence table

#### Scenario: Web collapse-down semantics survive the dedup

- **WHEN** a stage carries a manual at-risk or blocked status with no covering risk and no blocked item
- **THEN** `deriveEffectiveStageStatus` still collapses it to on-track
- **AND** the shared core itself carries no collapse-down branch

#### Scenario: Vocabulary adapters agree

- **WHEN** the same risk/item inputs are evaluated through the canonical adapter and the traffic-light adapter
- **THEN** the resulting statuses correspond under `canonicalToTrafficLight`

### Requirement: Risk severity is a required contract field

Every risk MUST carry an explicit severity (`at-risk` or `blocked`) through the whole stack — Zod contract, Prisma column without a default, read models, and the shared floor mapping — and no derivation path may carry a branch for an absent severity.

#### Scenario: The contract rejects a severity-less risk

- **WHEN** a risk payload without `severity` reaches the write contract
- **THEN** validation fails loud before persistence
- **AND** the Prisma column declares no default to absorb it

#### Scenario: Floor derivations consume explicit severity only

- **WHEN** `riskSeverityToCanonicalFloor` and its web/API callers are inspected
- **THEN** the floor maps exactly `blocked → blocked` and `at-risk → at-risk`
- **AND** no caller filters or coerces an undefined severity

### Requirement: Slide readiness derives project severity from the unified slide status model

The section-slide readiness model MUST count a real project as blocked or
at-risk from the same risk-derived product status used by that project's visible
slide badge. It MUST NOT derive project severity from persisted
`ReportSectionReadModel.projects[].trafficLight`. Synthetic cross-product slides
MUST NOT contribute a project severity count. Existing project-scoped risk-row
counts remain additive and MUST continue to contribute independently.

#### Scenario: Stale unbacked red does not block slide readiness

- **GIVEN** a real project whose persisted project traffic light and persisted
  owned-stage status are red
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
- **AND** the blocked risk row contributes its existing independent count
- **AND** the slide tone is blocked and the Risk story readiness item is
  required

#### Scenario: Synthetic cross-product status is not a project count

- **GIVEN** a section projection containing a synthetic cross-product slide
- **WHEN** section readiness counts blocked and at-risk projects
- **THEN** only projected product ids backed by `section.projects` contribute
  project severity counts
