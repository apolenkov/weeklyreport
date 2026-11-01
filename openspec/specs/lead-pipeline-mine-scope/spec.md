# lead-pipeline-mine-scope Specification

## Purpose

Defines which stages the lead pipeline shows in Mine mode, how the completeness counter labels them and which unassigned stages it excludes.

## Requirements

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
   a two-column grid; from 48 rem through below 80 rem they MUST render in a
   four-column contained grid; at 80 rem and above they MUST form one
   unwrapped compact fixed-width arrow lane. Connector arrows MUST render only in the wide lane,
   exactly between adjacent rendered stages. Wide stage controls MUST use the
   same compact width regardless of visible-stage count and MUST NOT grow to
   consume spare card width. Every grid and wide control MUST retain the stage
   icon, readable name, risk-derived status visualization, and interaction
   affordance; controls MUST be at least 44 px tall through tablet widths. Long
   labels MUST remain inside the card without clipping; truncation MUST retain
   the full accessible name and tooltip. At desktop width (80 rem and above),
   every canonical stage name MUST be rendered in full in the visible chip;
   compact short labels are reserved for narrower layouts. The contained
   four-column layout MUST continue through narrow desktop widths so the card
   never creates document-level horizontal overflow and every stage remains
   reachable without page scrolling.
7. All three responsive modes MUST use stable geometry: changing a stage's
   status or opening its existing interaction MUST NOT reorder stages, move the product
   header, or change the card's outer width except for the intended content
   change. Focused and hover states MUST remain visible and keyboard reachable.
   A risk-summary pulse MAY draw attention when motion is allowed, but MUST
   become a static, still-visible destructive-color signal when the user
   requests reduced motion.
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

- **WHEN** the product card renders at a viewport width of at least 80 rem
- **THEN** all visible stage controls form one non-wrapping horizontal pipeline
  in canonical order
- **AND** exactly one decorative connector appears between each adjacent pair
  of visible stages
- **AND** every stage control has the same compact width used by other product
  cards at that viewport, independent of the number of visible stages

#### Scenario: a wide viewport shows full canonical stage names

- **WHEN** a visible stage has a canonical name longer than its compact label,
  such as `Development`, at a viewport width of at least 80 rem
- **THEN** the desktop chip renders the complete canonical name
- **AND** the name remains inside the equal-width chip without clipping

#### Scenario: a phone viewport uses a two-column grid

- **WHEN** the product card renders below 48 rem
- **THEN** visible stages occupy a two-column grid in canonical order
- **AND** connector arrows are absent and the card creates no horizontal
  scroller or root overflow

#### Scenario: a tablet viewport uses a four-column grid

- **WHEN** the product card renders from 48 rem through below 80 rem
- **THEN** visible stages occupy a four-column grid in canonical order
- **AND** connector arrows are absent, every stage control is at least 44 px
  tall, and the card creates no horizontal scroller or root overflow

#### Scenario: rows remain stable while a stage changes state

- **WHEN** a visible stage changes status or its existing interaction is opened
- **THEN** the other stage controls retain canonical order and their responsive
  mode
- **AND** the product header and top-level card width do not jump

#### Scenario: reduced motion keeps the product risk signal static

- **WHEN** a product has a risk summary and the browser requests reduced motion
- **THEN** its destructive-color risk dot remains visible without pulsing
- **AND** the textual risk summary remains unchanged

#### Scenario: no indicator when the lead owns every stage

- **WHEN** a lead views a product in Mine mode where they own all of its assigned
  stages
- **THEN** no stage is hidden, so the collapsed-stage indicator does NOT appear

#### Scenario: the indicator never appears in Everyone mode

- **WHEN** the lead switches a product with hidden Mine-mode stages to Everyone
  mode
- **THEN** the full stage list renders and the collapsed-stage indicator is NOT
  shown

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

### Requirement: Unassigned stages are excluded from a product's pipeline

A stage with no assignment on a product MUST be excluded from that product's
stage set — it MUST NOT render (in Mine or Everyone mode), MUST NOT be counted,
and MUST NOT be awaited — as if the stage does not exist for the product.
Exclusion is purely assignment-driven: the product's stage set is exactly the
stages with an assignment to ANY lead on the product. A **foreign-owned** stage
(assigned to another lead) is NOT unassigned and stays in the set. The stage set
is READ-ONLY display metadata: it MUST NOT widen the write path, so a lead can
never persist a stage status for a stage they do not own (the save path stays
scoped to the lead's owned stages). Excluding unassigned stages MUST NOT change
any product-health, severity, or completeness number: a risk only floors health
through owned stages, so a stage nobody owns never drives the traffic light;
a covering risk stays listed in the risk section, so severity stays explained by
a visible object. Published report snapshots are frozen: this requirement governs
the live/draft pipeline render and MUST NOT retroactively alter an
already-published snapshot when assignments later change.

#### Scenario: an unassigned stage does not render

- **WHEN** a product has no assignment on the DevOps stage
- **THEN** the DevOps stage chip does not render in Mine or Everyone mode
- **AND** DevOps is not part of that product's stage set, not counted in any
  stage total, and not awaited for reporting

#### Scenario: a foreign-owned stage is not treated as unassigned

- **WHEN** a stage on the product is assigned to another lead (not the current
  lead)
- **THEN** that stage stays in the product's stage set — hidden in Mine mode,
  rendered as a locked chip in Everyone mode — and is never excluded as
  "unassigned"

#### Scenario: a risk on an unassigned stage keeps severity explained without the chip

- **WHEN** no one is assigned to a stage but a risk names that stage for the
  period
- **THEN** the stage chip is still excluded from the pipeline (no assignment)
- **AND** the covering risk remains listed in the risk section, and no
  product-health number changes versus before the exclusion

#### Scenario: the stage set never widens the write path

- **WHEN** a product's stage set includes a stage the current lead does not own
  (assigned to another lead)
- **THEN** that stage is shown read-only and the lead cannot persist a status for
  it; saving the section writes statuses only for the lead's owned stages

#### Scenario: a published snapshot is not changed by later unassignment

- **WHEN** a stage that was assigned at publish time later loses its assignment
- **THEN** the already-published report's snapshot still shows that stage as it
  was at publish; only the live/draft pipeline reflects the new exclusion
