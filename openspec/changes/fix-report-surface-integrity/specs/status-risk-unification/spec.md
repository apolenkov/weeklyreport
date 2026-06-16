## MODIFIED Requirements

### Requirement: Covering risks force a severity floor on stage chips

A stage chip MUST render at least at the highest covering risk's
severity when its stage is covered by at least one non-empty own risk
(precedence: blocked > at-risk). The chip MUST NOT show on-track or
empty while covering risks exist. The floor is applied at RENDER time —
by the live lead form (`applyRiskSeverityFloor` in
`lead-form-sync-bridge.tsx`) and the slides/head-review surface
(`floorSlideStageStatus` in `section-slide-utils.ts`), both deriving the
severity through the shared `deriveEffectiveStageStatus`. The read-model
mapper (`mapLeadProducts` in `apps/web/src/lib/mappers/lead-form.ts`)
PRESERVES the raw stage status (it keeps the empty→empty guard) and only
additionally annotates `coveredByOwnRisk`; it MUST NOT floor the raw
status, because the raw status drives both the X/7 completeness counter
(which must not count foreign-covered stages) and the chip's
risk-covered-vs-status-set distinction. The head-form, preview, and
PDF/print surfaces carry no per-stage grid — they render the
product-level `worstStatus`, which already reflects risk severity — so
all surfaces agree without the mapper flooring. This supersedes the PRJ-2
decision that disconnected risk-derived status in `mapLeadProducts`.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked
  covering the Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra
  confirmation

#### Scenario: a stale persisted on-track status is floored on load

- **WHEN** a draft loads whose persisted explicit stage status is
  on-track while a non-empty covering risk with severity at-risk
  exists
- **THEN** the chip renders at-risk on the lead form, head review, and
  export surfaces

#### Scenario: the read-model mapper floors for head review and export

- **WHEN** the read-model mapper builds the head review and PDF export
  view of a product whose stage has an empty status but a non-empty
  covering own risk
- **THEN** the mapper applies the same severity floor as the live form
- **AND** head review and PDF export render the same floored severity as
  the lead form, not an un-floored empty

## ADDED Requirements

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
