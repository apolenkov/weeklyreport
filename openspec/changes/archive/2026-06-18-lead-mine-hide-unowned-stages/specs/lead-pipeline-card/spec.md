## ADDED Requirements

### Requirement: The pipeline shows only the lead's own stages in Mine mode

The lead SDLC pipeline MUST scope which stage chips render to the visibility mode, so that Mine reads as the lead's own contribution and Everyone shows the fuller team picture, without changing the health or completeness signals.

1. In **Mine** mode the pipeline MUST render only the stages the current lead
   owns. Stages owned by another author, and stages with no owner (vacant),
   MUST NOT render — they are hidden, not greyed.
2. In **Everyone** mode the pipeline MUST render the lead's own stages plus the
   stages owned by other authors (as the existing locked chips) and any vacant
   (unassigned) stages, so the full pipeline is visible.
3. Hiding non-owned chips MUST NOT change the product health (left edge)
   severity or the own-input completeness count: both are derived from the
   underlying risks/status and the lead's owned-stage set, independent of which
   chips are rendered.
4. When the lead owns none of a product's stages, the product MUST still render
   (with its honest health) and show a brief "No stages assigned to you" note in
   place of an empty stage grid, rather than collapsing to nothing.

#### Scenario: Mine shows only the lead's stages

- **WHEN** a lead views a product in Mine mode where they own two of the seven
  stages and other authors own the rest
- **THEN** only the two owned stage chips render; the other stages do not appear

#### Scenario: Everyone reveals foreign and vacant stages

- **WHEN** the same lead switches that product to Everyone mode
- **THEN** the two owned chips plus the foreign-owned (locked) chips and any
  vacant stage render, showing the full pipeline

#### Scenario: hiding chips does not change health or completeness

- **WHEN** a product is covered by a blocker raised on a stage the lead does not
  own, and the lead is in Mine mode
- **THEN** the foreign stage chip is hidden
- **AND** the product left edge still shows the blocked severity (health stays
  honest) and the own-input completeness count is unchanged

#### Scenario: a product with no own stages still renders

- **WHEN** in Mine mode a lead views a product on which they own no stages
- **THEN** the product card still renders with its health signal and shows a
  "No stages assigned to you" note instead of an empty grid
