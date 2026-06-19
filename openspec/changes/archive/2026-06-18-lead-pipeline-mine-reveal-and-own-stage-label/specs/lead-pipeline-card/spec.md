# lead-pipeline-card Specification

## MODIFIED Requirements

### Requirement: The pipeline shows only the lead's own stages in Mine mode

The lead SDLC pipeline MUST scope which stage chips render to the visibility mode, so that Mine reads as the lead's own contribution and Everyone shows the fuller team picture, without changing the health or completeness signals.

1. In **Mine** mode the pipeline MUST render only the stages the current lead
   owns. Stages owned by another author, and stages with no owner (vacant),
   MUST NOT render inline — they are hidden, not greyed.
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
5. In **Mine** mode, when one or more of a product's stages are hidden by the
   filter AND at least one own stage still renders, the card MUST show a small
   inert indicator that those stages are collapsed. The indicator MUST reveal,
   on hover, the hidden stages' names and statuses, AND MUST expose the same
   information non-visually (e.g. through accessible label text), so a
   non-visual user gets the hidden stages' statuses too. The reveal MUST NOT
   re-render the hidden chips inline or change the rendered own-stage set; it
   is a read-only summary. The mechanism (native title attribute versus a
   tooltip primitive) is left to implementation.
6. The collapsed-stage indicator MUST appear ONLY in Mine mode. In Everyone
   mode, where the full grid already renders, the indicator MUST NOT appear.
   When the lead owns none of a product's stages, the "No stages assigned to
   you" note MUST take precedence and the indicator MUST NOT be shown for that
   product.

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
- **AND** the collapsed-stage indicator is NOT shown — the note takes precedence

#### Scenario: Mine shows a collapsed-stage indicator that reveals hidden statuses on hover

- **WHEN** a lead views a product in Mine mode where they own two of the seven
  stages and the other five are hidden by the filter
- **THEN** the card shows a small inert indicator that five stages are collapsed
- **AND** hovering the indicator reveals those five hidden stages' names and
  statuses
- **AND** the same hidden-stage statuses are exposed non-visually through the
  indicator's accessible label, not by visual hover alone

#### Scenario: no indicator when the lead owns every stage

- **WHEN** a lead views a product in Mine mode where they own all of its stages
- **THEN** no stage is hidden, so the collapsed-stage indicator does NOT appear

#### Scenario: the indicator never appears in Everyone mode

- **WHEN** the lead switches a product with hidden Mine-mode stages to Everyone
  mode
- **THEN** the full grid renders and the collapsed-stage indicator is NOT shown

## ADDED Requirements

### Requirement: The completeness counter labels the count as the lead's own stages

The own-input completeness counter MUST label its count as the lead's OWN stages, so the "N/M" reads as the lead's personal input rather than the whole pipeline. The counter denominator already counts only the lead's owned stages (`computeCompleteness` filters `ownership === "mine"`), so the label MUST NOT change the count — it only clarifies what the count covers. The label text MUST be a static English string (e.g. "Your stages") consistent with the repo's English-UI rule.

#### Scenario: the counter reads as the lead's own stages

- **WHEN** a lead in edit mode views a product where they own three stages and
  have filled two of them
- **THEN** the counter shows two of three and is labeled as the lead's own
  stages (e.g. "Your stages")
- **AND** the displayed count is identical to the pre-label behavior — only the
  label clarifies whose stages are counted

#### Scenario: the label does not imply the whole pipeline

- **WHEN** a product has seven stages but the lead owns only three
- **THEN** the counter denominator is three (the lead's own stages), and the
  label makes clear the count is the lead's stages, not all seven
