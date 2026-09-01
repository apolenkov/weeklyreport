# lead-pipeline-card Specification

## Purpose

Present each lead product pipeline with risk-derived health separated from the lead's own stage-input completeness and Mine-scope ownership.

## Requirements

### Requirement: The pipeline card separates product health from own-input completeness

The lead SDLC pipeline product card MUST encode two orthogonal signals with two
distinct affordances, so "is this product healthy?" and "did I finish my input?"
never share one cue.

1. The product **health** signal (left edge) MUST reflect risk/blocker severity
   contributed by any stage owner: when a covering risk or blocker exists for
   the product, the left edge MUST show that severity (at-risk / blocked) and
   MUST NOT read as healthy/green.
2. The **own-input completeness** signal MUST be a separate affordance (not the
   health color) indicating whether the responsible person has completed their
   input for the product.

#### Scenario: a stage owner flagged a blocker on an otherwise-filled product

- **WHEN** a product has a covering blocker raised by a stage owner and the
  lead has filled all their input
- **THEN** the left edge shows the blocked severity (not green)
- **AND** the completeness affordance shows the input as complete — the two
  signals are independent

#### Scenario: a healthy product with incomplete input

- **WHEN** a product has no covering risk but the lead has not finished their
  input
- **THEN** the left edge reads healthy
- **AND** the completeness affordance shows the input as incomplete

### Requirement: Stage status is derived from one source — the covering risks

The displayed stage/product status MUST be derived from the risks that cover the
stage, so the Risks section and the status display can never disagree. There is
no separate manual status that can drift from the risks.

1. Adding or removing a covering risk MUST immediately update the stage chip,
   the left edge, and any slide/preview view — with no manual re-sync step.
2. A stage MAY be covered by multiple risks (one-to-many). The displayed status
   MUST collapse to the HIGHEST covering severity (blocker > at-risk >
   on-track); all covering risks remain listed.
3. Because status is derived, a stage marked at-risk or blocked without a
   backing risk MUST be rendered as on-track; no separate stale-status warning
   is needed.

#### Scenario: a risk is added in the Risks section

- **WHEN** a lead adds a blocker covering the Development stage
- **THEN** the Development chip and the product left edge show blocked
  immediately, with no separate sync action

#### Scenario: a stage is covered by both a risk and a blocker

- **WHEN** one stage is covered by an at-risk AND a blocker risk
- **THEN** the displayed stage status is blocked (highest severity)
- **AND** both covering risks remain visible in the Risks section

### Requirement: Own-input completeness counts only stages the lead explicitly set

Own-input completeness MUST count a stage as addressed when EITHER
the lead set an explicit non-empty status on it OR the stage is covered
by the current lead's OWN non-empty staged risk. A risk is the lead's
input about that stage, so a stage the lead never explicitly set still
counts when their own risk covers it. The counter MUST be derived from a
`coveredByOwnRisk` annotation placed on the raw stage by the read-model
mapper (`mapLeadProducts` in `apps/web/src/features/report-sections/model/lead-form.ts`),
where `computeCompleteness` counts a stage when
`status !== "empty" || coveredByOwnRisk`. Foreign coverage MUST NOT inflate the
counter:

1. A foreign or cross-author covering risk MAY color the chip (display
   floor) but MUST NOT set `coveredByOwnRisk` and MUST NOT count toward
   this lead's completeness — another lead's risk never finishes this
   lead's input.

This MUST hold on reload: `coveredByOwnRisk` is derived from the
persisted own risks plus the raw per-stage status, never from transient
floored display state.

#### Scenario: an untouched stage covered by the lead's own staged risk counts

- **WHEN** the lead owns three stages with no explicit status set, and
  saves one own risk that explicitly covers all three stages
- **THEN** the three stage chips render at the risk severity (display floor)
- **AND** the completeness counter reads 3 of 3 because each stage is
  `coveredByOwnRisk`
- **AND** after a page reload the counter still reads 3 of 3 — derived
  from the persisted risk plus raw status

#### Scenario: a foreign covering risk colors but does not count

- **WHEN** an untouched stage the lead owns is covered only by another
  author's risk
- **THEN** the chip renders at the covering severity (display floor)
- **AND** the completeness counter does NOT count that stage —
  `coveredByOwnRisk` is false for a foreign risk

### Requirement: The pipeline chip distinguishes risk-covered from explicit status

A stage chip MUST visually distinguish risk-covered from explicit
status. The chip in `SdlcPipeline`
(`apps/web/src/features/period/ui/sdlc-pipeline.tsx`) MUST visually
distinguish a stage that is addressed because it is `coveredByOwnRisk`
from a stage that is addressed because the lead set an explicit status,
even when both render at the same severity color. The distinction MUST
also be exposed non-visually through the chip's `aria-label` and tooltip
text (e.g. "Blocked by risk" versus "Blocked — status set"), so a
non-visual user gets the same distinction as a sighted one.

#### Scenario: a risk-covered chip is distinguishable from a status-set chip

- **WHEN** one chip is addressed only via the lead's covering risk and
  another chip at the same severity is addressed via an explicit status
- **THEN** the two chips are visually distinguishable
- **AND** each chip's `aria-label` and tooltip name whether it is covered
  by a risk or has an explicit status set

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

### Requirement: The collapsed-stages indicator reveals through the styled tooltip

The `+N more` collapsed-stages indicator MUST reveal the hidden stages through the shared Radix `Tooltip` from `packages/ui` — the same component the stage chips use — as a multi-line list (one stage per line), and MUST distinguish an owned-but-unstatused stage from one with a covering status so it never mislabels an occupied stage as empty. The indicator's tooltip surface MUST use the app's light popover tokens (`bg-popover`/`text-popover-foreground` with a border and shadow), NOT the shared Radix dark default (`bg-foreground`/`text-background`), and the dark Radix arrow MUST be hidden — applied as a scoped override on this one indicator so the shared dark default still serves the stage chips and the sidebar.

1. On pointer hover/focus the indicator MUST show the hidden stages through the
   shared Radix tooltip, one stage per line; the custom `useSdlcTooltip` is no
   longer used for the pipeline.
2. A hidden stage that is OWNED by another author MUST read as that owner plus an
   explicit "no status set" note when the lead has set no status; it MUST NOT
   read as "empty".
3. Every hidden stage is foreign-owned (assigned to another lead); there is NO
   unassigned hidden row, because unassigned stages are excluded from the stage
   set entirely. A hidden foreign-owned stage with no status set MUST read as its
   owner plus "no status set", NOT as "unassigned".
4. The non-visual `aria-label` listing the hidden stages MUST be retained as the
   screen-reader path (the indicator is inert and not a keyboard tab stop).
5. The indicator's tooltip surface MUST be the light popover surface (the same
   `bg-popover`/`text-popover-foreground` tokens as `dropdown-menu`/`select`),
   with the dark Radix arrow hidden. This restyle is SCOPED to the collapsed
   indicator via a `className` override and MUST NOT change the shared dark
   `TooltipContent` default used by stage chips and the sidebar; it introduces no
   new token, theme, or background.

#### Scenario: An owned hidden stage is not shown as empty

- **WHEN** a lead in Mine mode hovers the `+N more` indicator and a hidden stage is
  owned by another author with no status set
- **THEN** that line shows the owner and "no status set"
- **AND** it does not read as "empty"

#### Scenario: There is no unassigned hidden row

- **WHEN** a lead in Mine mode hovers the `+N more` indicator
- **THEN** every revealed row is a foreign-owned stage (by owner + status); no row
  reads "unassigned", because unassigned stages are not in the stage set

#### Scenario: The reveal is multi-line through the shared Radix tooltip

- **WHEN** the indicator is hovered
- **THEN** the hidden stages appear one per line via the shared Radix `Tooltip`
- **AND** moving the pointer away hides it

#### Scenario: The reveal uses the softer light popover surface

- **WHEN** a lead in Mine mode hovers the `+N more` indicator
- **THEN** the reveal renders on the light popover surface (`bg-popover`, not the dark `bg-foreground` default) with no dark arrow
- **AND** the stage-chip and sidebar tooltips keep the shared dark surface (the override is scoped to this indicator)

### Requirement: The collapsed-stages indicator surfaces the worst hidden severity

The `+N more` collapsed-stages indicator MUST color its border and text by the full status scale of the hidden stages, by precedence, so the product's left health stripe is traceable to the collapsed stages at a glance.

1. The color precedence MUST be: red when any hidden stage is `blocked`; otherwise
   yellow when any is `at-risk`; otherwise grey when any is unfilled (`empty` —
   owned but unstatused); otherwise green when every hidden stage is `on-track`.
2. A fully on-track hidden set MUST read green, and a partially unfilled set
   MUST read grey.
3. This color is derived from the same hidden-stage set the indicator reveals; it
   MUST NOT change product health (left stripe) or the own-input completeness counter.

#### Scenario: All hidden stages on-track color the indicator green

- **WHEN** a lead in Mine mode has hidden stages that are all `on-track`
- **THEN** the `+N more` indicator renders green
- **AND** the product health stripe and the `N/M Your stages` counter are unchanged

#### Scenario: An unfilled hidden stage colors the indicator grey

- **WHEN** the worst hidden stage is no worse than `on-track` but at least one
  hidden stage is `empty` (owned but unstatused)
- **THEN** the `+N more` indicator renders grey

#### Scenario: A hidden blocked stage colors the indicator red

- **WHEN** any hidden stage is `blocked`
- **THEN** the `+N more` indicator renders in the blocked status color

### Requirement: The +N more reveal color-codes each hidden stage row by status

The `+N more` reveal popover MUST color-code each hidden-stage row by that stage's effective status so problem stages stand out at a glance: blocked → the blocked (red) token, at-risk → the at-risk (amber) token, on-track → the on-track (green) token, and `empty` (owned but unstatused) → a neutral muted treatment. The colors MUST resolve through the existing `STATUS_CONFIG` / `--color-*` tokens — no new color token may be introduced — and the per-row status MUST come from the already-computed effective status of each hidden stage, not a re-derivation.

#### Scenario: hidden stages have mixed statuses

- **WHEN** the lead hovers the `+N more` reveal and the hidden stages include a
  blocked stage, an at-risk stage, an on-track stage, and an `empty` (owned but
  unstatused) stage
- **THEN** the blocked row renders in the red token, the at-risk row in amber,
  the on-track row in green, and the empty row in the neutral muted treatment
- **AND** every color resolves through an existing token (no new token is added)

#### Scenario: a foreign-owned stage shows the covering status

- **WHEN** a hidden stage is held by another owner with a covering status
- **THEN** the row is colored by that covering (effective) status, consistent
  with the chip's display floor

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
