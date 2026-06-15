## MODIFIED Requirements

### Requirement: Covering risks force a severity floor on stage chips

A stage chip MUST render at least at the highest covering risk's
severity when its stage is covered by at least one non-empty own risk
(precedence: blocked > at-risk). The chip MUST NOT show on-track or
empty while covering risks exist. The floor MUST be applied by the
read-model mapper (`mapLeadProducts` in
`apps/web/src/lib/mappers/lead-form.ts`) identically to the live lead
form, so the head review surface and the PDF export agree with the lead
form. The read-model mapper MUST NOT guard an empty-but-covered stage
back down to empty. This supersedes the PRJ-2 decision that
disconnected risk-derived status in `mapLeadProducts`.

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
