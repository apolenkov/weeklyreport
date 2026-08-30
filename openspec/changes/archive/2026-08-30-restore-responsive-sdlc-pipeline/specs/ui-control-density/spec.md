## MODIFIED Requirements

### Requirement: SDLC pipeline arrows center on the stage chip box

At viewport widths of 64 rem (1024 CSS px) and above, the connector arrow
between SDLC stage chips MUST be vertically centered on the chip box itself —
not on the chip-plus-assignee-label column. Consumer surface:
`apps/web/src/features/period/ui/sdlc-pipeline.tsx` with `stage-chip.tsx`, reused
by the read-only head/report surfaces. The chip box and arrow box MUST derive
their height from one shared named constant, so alignment holds by construction
with and without assignee names. Chip boxes MUST share a common top edge and the
pipeline MUST NOT wrap. Stage boxes MUST use one equal compact width and MUST
NOT grow when a product has fewer visible stages. Each connector MUST be decorative, hidden from the
accessibility tree, and excluded from keyboard navigation. From 48 rem through
below 64 rem, the pipeline MUST use a four-column grid without connector arrows;
below 48 rem it MUST use a two-column grid without connector arrows. Both grid
modes MUST avoid horizontal scrollers and root horizontal overflow, and stage
controls MUST retain the 44 px touch floor.

#### Scenario: stages render with assignee names below the chips

- **WHEN** the pipeline renders at or above 64 rem and stage chips carry
  assignee labels
- **THEN** each connector arrow's vertical midline matches the adjacent chip
  boxes' vertical midline
- **AND** chip and arrow boxes carry the same shared height value
- **AND** assignee-label height does not shift a chip or connector

#### Scenario: connector arrows are decorative

- **WHEN** a keyboard or assistive-technology user traverses a wide pipeline
- **THEN** each stage control remains reachable in canonical order
- **AND** connector arrows receive no focus and contribute no accessible name

#### Scenario: the stages row wraps on a narrow viewport

- **WHEN** the viewport becomes narrower than 64 rem
- **THEN** the pipeline switches to a four-column grid from 48 rem through
  below 64 rem and a two-column grid below 48 rem
- **AND** connector arrows are absent rather than wrapping onto misleading
  lines
- **AND** the product card creates no horizontal scroller or root horizontal
  overflow
