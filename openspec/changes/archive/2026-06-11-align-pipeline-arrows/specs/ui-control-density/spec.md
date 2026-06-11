## ADDED Requirements

### Requirement: SDLC pipeline arrows center on the stage chip box

The connector arrow between SDLC stage chips MUST be vertically
centered on the chip box itself — not on the chip-plus-assignee-label
column. Consumer surface: `apps/web/src/components/lead/sdlc-pipeline.tsx`
with `stage-chip.tsx`, reused by the read-only head/report surfaces. The
chip box and the arrow box MUST derive their height from one shared
named constant (the same single-height-token property this capability
already fixes for control clusters), so the alignment holds by
construction with and without assignee names. Within one flex-wrap
row, chip boxes MUST share a common top edge; variable-height assignee
labels hang below the chip box and MUST NOT shift the chip or the
arrow vertically.

#### Scenario: stages render with assignee names below the chips

- **WHEN** the pipeline renders a product whose stage chips carry
  assignee labels (named or "— unassigned")
- **THEN** each connector arrow's vertical midline matches the
  adjacent chip box's vertical midline
- **AND** the chip and arrow boxes carry the same shared height value

#### Scenario: the stages row wraps on a narrow viewport

- **WHEN** the flex-wrap stages row breaks into multiple rows
- **THEN** on every wrap row the chip boxes share a common top edge
- **AND** every arrow stays centered on the chip box, regardless of
  which stages carry assignee labels
