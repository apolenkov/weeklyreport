## Purpose

Risk rows are the single source of truth for at-risk/blocked stage states on the
lead report. This capability governs how covering risks floor stage chips at
render, how the lead's own risk coverage counts toward own-input completeness
(without letting foreign or stage-less risks inflate it), how a covered chip is
lowered, and the risk-entry dialog's stage-selection defaults.

## Requirements

### Requirement: Risks are the single source of truth for at-risk/blocked

At-risk and blocked states MUST be authored only as risk rows in the
Risks section of the lead report. Stage chips (`SdlcPipeline` in
`apps/web/src/components/lead/sdlc-pipeline.tsx`) MUST NOT create an
at-risk/blocked state that is not backed by a risk row; chip
interactions that imply such a state route through risk creation or
deletion instead.

#### Scenario: a chip click is never the only record of a risk

- **WHEN** the lead attempts to set a stage chip to at-risk or blocked
  and no covering risk row exists
- **THEN** the stage status is not applied directly
- **AND** the risk edit dialog opens in create mode prefilled with the
  product, the clicked stage, and the clicked severity

#### Scenario: cancelling the prefilled dialog leaves the chip unchanged

- **WHEN** the lead cancels the risk edit dialog opened by a chip
  interception
- **THEN** the chip keeps its previous status and no risk row is
  created

### Requirement: Covering risks force a severity floor on stage chips

A stage chip, AS DISPLAYED, MUST render at least at the highest covering
risk's severity when its stage is covered by at least one non-empty own
risk (precedence: blocked > at-risk). The DISPLAYED chip MUST NOT show
on-track or empty while covering risks exist. This DISPLAY floor is
applied at RENDER time — by the live lead form (`applyRiskSeverityFloor`
in `lead-form-sync-bridge.tsx`) and the slides/head-review surface
(`floorSlideStageStatus` in `section-slide-utils.ts`), both deriving the
severity through the shared `deriveEffectiveStageStatus`.

The RAW read-model status is a SEPARATE layer from the displayed chip. The
mapper (`mapLeadProducts` in `apps/web/src/lib/mappers/lead-form.ts`)
applies the floor to a NON-EMPTY stage (via `deriveEffectiveStageStatus`:
floor up to a worse covering risk, collapse a stale unbacked severity
down) but PRESERVES an EMPTY stage's raw status as empty — the empty→empty
guard. It MUST NOT floor an EMPTY stage's RAW status up to a covering
severity; it records that coverage separately via the `coveredByOwnRisk`
annotation. This raw empty is NOT what the chip displays — the render
floor above already prevents an empty-looking covered chip — it is what
the X/7 completeness counter (which must not count foreign-covered stages)
and the chip's risk-covered-vs-status-set distinction rely on.

The head-form, preview, and PDF/print surfaces carry no per-stage grid —
they render the product-level `worstStatus`, which already reflects risk
severity. This supersedes the PRJ-2 decision that disconnected
risk-derived status in `mapLeadProducts`.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked
  covering the Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra
  confirmation

#### Scenario: a stale persisted on-track status is floored on load

- **WHEN** a draft loads whose persisted explicit stage status is
  on-track while a non-empty covering risk with severity at-risk
  exists
- **THEN** the chip renders at-risk on the lead form and the head-review
  slides (a non-empty status is floored by the mapper too — only an empty
  status is preserved)
- **AND** the head-form and PDF/print surfaces (which carry no per-stage
  grid) reflect the risk through the product-level `worstStatus`

#### Scenario: the read-model mapper preserves raw status and annotates coverage

- **WHEN** the read-model mapper builds the view of a product whose stage
  has an empty status but a non-empty covering own risk
- **THEN** the mapper keeps the stage's raw status empty and sets
  `coveredByOwnRisk` to true (it does NOT floor the raw status)
- **AND** the live lead form and the slides/head-review surface re-floor
  the chip to the risk severity at render, while the head-form, preview,
  and PDF export surfaces (which have no per-stage grid) reflect the risk
  through the product-level `worstStatus` — so no surface shows an
  un-floored empty

### Requirement: Lowering a covered chip requires confirmed risk removal

Setting a covered chip to on-track MUST ask for confirmation that
names the consequence before any state changes. On confirm, each
covering own risk MUST either be deleted (the clicked stage was its
only stage) or have the clicked stage removed from its `stageIds`
(it covers other stages — surviving risks keep at least one stage).
On cancel, chip and risks MUST be unchanged. If any covering risk
belongs to another author, the lowering MUST be blocked with an
explanatory message instead of deleting foreign data.

#### Scenario: confirming the lowering deletes the covering risk

- **WHEN** the lead sets a chip to on-track whose stage is covered by
  one single-stage own risk and confirms the dialog
- **THEN** that risk row is deleted and the chip flips to on-track

#### Scenario: a multi-stage risk survives with the stage stripped

- **WHEN** the lead confirms lowering a chip covered by a risk that
  also covers another stage
- **THEN** the risk row survives with the clicked stage removed from
  its `stageIds`
- **AND** the other covered chip keeps its severity floor

#### Scenario: cancelling the confirmation changes nothing

- **WHEN** the lead cancels the deletion confirmation
- **THEN** the chip keeps its at-risk/blocked status and all risk rows
  are unchanged

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The risk-entry dialog stage multi-select MUST NOT default to every owned
stage checked. When the dialog opens from a clicked chip it MUST default
the selection to that clicked stage only. Switching the product through
`setProductAndStages` MUST NOT auto-select all of the newly-owned
stages; it MUST clear the selection or keep only the originating stage. A
risk MAY still deliberately cover several stages, but multi-stage
coverage MUST be a deliberate choice, never the default.

#### Scenario: opening the dialog from a chip selects only that stage

- **WHEN** the lead opens the risk-entry dialog by clicking a single
  stage chip
- **THEN** the stage multi-select has only the clicked stage checked
- **AND** the other owned stages are unchecked

#### Scenario: switching product does not auto-select all owned stages

- **WHEN** the lead changes the product in the open risk dialog via
  `setProductAndStages`
- **THEN** the stage multi-select does not auto-check every stage owned
  on the new product
- **AND** the selection is cleared or keeps only the originating stage
