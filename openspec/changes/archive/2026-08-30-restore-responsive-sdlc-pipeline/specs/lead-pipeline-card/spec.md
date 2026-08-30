## MODIFIED Requirements

### Requirement: The pipeline shows only the lead's own stages in Mine mode

The lead SDLC pipeline MUST scope which stage controls render to the visibility
mode, so that Mine reads as the lead's own contribution and Everyone shows the
fuller team picture, without changing the health or completeness signals.

1. In **Mine** mode the pipeline MUST render only the stages the current lead
   owns. Stages owned by another author MUST NOT render as stage controls — they
   are hidden, not greyed. A stage with no assignment on the product is NOT part
   of the product's stage set (see "Unassigned stages are excluded from a
   product's pipeline") and therefore never renders in any mode.
2. In **Everyone** mode the pipeline MUST render the lead's own stages plus the
   stages owned by other authors (the existing locked chips). It MUST NOT render
   an "unassigned" or vacant control — an unassigned stage is excluded from the
   product's stage set, not greyed.
3. Hiding non-owned controls MUST NOT change the product health (left edge)
   severity or the own-input completeness count: both are derived from the
   underlying risks/status and the lead's owned-stage set, independent of which
   controls are rendered.
4. When the lead owns none of a product's stages, the product MUST still render
   with its honest health and show a brief "No stages assigned to you" note in
   place of an empty pipeline, rather than collapsing to nothing.
5. In **Mine** mode, when one or more of a product's stages are hidden by the
   filter AND at least one own stage still renders, the card MUST show a small
   inert indicator that those stages are collapsed. The indicator MUST reveal,
   on hover, the hidden stages' names and statuses, AND MUST expose the same
   information non-visually, so a non-visual user gets the hidden stages'
   statuses too. The reveal MUST NOT re-render the hidden controls or change the
   rendered own-stage set; it is a read-only summary.
6. The visible stages MUST preserve canonical order without a horizontal
   scroller or page-level horizontal overflow. Below 48 rem they MUST render in
   a two-column grid; from 48 rem through below 64 rem they MUST render in a
   four-column grid; at 64 rem and above they MUST form one unwrapped compact
   fixed-width arrow lane. Connector arrows MUST render only in the wide lane,
   exactly between adjacent rendered stages. Wide stage controls MUST use the
   same compact width regardless of visible-stage count and MUST NOT grow to
   consume spare card width. Every grid and wide control MUST retain the stage
   icon, readable name, risk-derived status visualization, and interaction
   affordance; controls MUST be at least 44 px tall through tablet widths. Long
   labels MUST remain inside the card without clipping; truncation MUST retain
   the full accessible name and tooltip.
7. All three responsive modes MUST use stable geometry: changing a stage's
   status or opening its existing interaction MUST NOT reorder stages, move the product
   header, or change the card's outer width except for the intended content
   change. Focused and hover states MUST remain visible and keyboard reachable.
8. The collapsed-stage indicator MUST appear ONLY in Mine mode. In Everyone
   mode, where the full stage list already renders, the indicator MUST NOT
   appear. When the lead owns none of a product's stages, the "No stages
   assigned to you" note MUST take precedence and the indicator MUST NOT be
   shown for that product.

#### Scenario: Mine shows only the lead's stages

- **WHEN** a lead views a product in Mine mode where they own two of the
  product's assigned stages and other authors own the rest
- **THEN** only the two owned stage controls render; the other stages do not
  appear
- **AND** each rendered control contains its stage icon, name, and status
  visualization

#### Scenario: Everyone reveals foreign-owned stages, not vacant ones

- **WHEN** the same lead switches that product to Everyone mode
- **THEN** the two owned controls plus the foreign-owned locked controls render,
  showing the full pipeline of the product's assigned stages
- **AND** no "unassigned" or vacant control appears

#### Scenario: hiding chips does not change health or completeness

- **WHEN** a product is covered by a blocker raised on a stage the lead does not
  own, and the lead is in Mine mode
- **THEN** the foreign stage control is hidden
- **AND** the product left edge still shows blocked severity and the own-input
  completeness count is unchanged

#### Scenario: a product with no own stages still renders

- **WHEN** in Mine mode a lead views a product on which they own no stages
- **THEN** the product card still renders with its health signal and shows a
  "No stages assigned to you" note instead of an empty pipeline
- **AND** the collapsed-stage indicator is NOT shown

#### Scenario: Mine shows a collapsed-stage indicator that reveals hidden statuses on hover

- **WHEN** a lead views a product in Mine mode where they own some of the
  product's assigned stages and the rest are hidden by the filter
- **THEN** the card shows a small inert indicator that the remaining stages are
  collapsed
- **AND** hover and non-visual text expose those hidden stages' names and
  statuses without rendering the hidden controls

#### Scenario: a wide viewport shows the connected process

- **WHEN** the product card renders at a viewport width of at least 64 rem
- **THEN** all visible stage controls form one non-wrapping horizontal pipeline
  in canonical order
- **AND** exactly one decorative connector appears between each adjacent pair
  of visible stages
- **AND** every stage control has the same compact width used by other product
  cards at that viewport, independent of the number of visible stages

#### Scenario: a phone viewport uses a two-column grid

- **WHEN** the product card renders below 48 rem
- **THEN** visible stages occupy a two-column grid in canonical order
- **AND** connector arrows are absent and the card creates no horizontal
  scroller or root overflow

#### Scenario: a tablet viewport uses a four-column grid

- **WHEN** the product card renders from 48 rem through below 64 rem
- **THEN** visible stages occupy a four-column grid in canonical order
- **AND** connector arrows are absent, every stage control is at least 44 px
  tall, and the card creates no horizontal scroller or root overflow

#### Scenario: rows remain stable while a stage changes state

- **WHEN** a visible stage changes status or its existing interaction is opened
- **THEN** the other stage controls retain canonical order and their responsive
  mode
- **AND** the product header and top-level card width do not jump

#### Scenario: no indicator when the lead owns every stage

- **WHEN** a lead views a product in Mine mode where they own all of its assigned
  stages
- **THEN** no stage is hidden, so the collapsed-stage indicator does NOT appear

#### Scenario: the indicator never appears in Everyone mode

- **WHEN** the lead switches a product with hidden Mine-mode stages to Everyone
  mode
- **THEN** the full stage list renders and the collapsed-stage indicator is NOT
  shown
