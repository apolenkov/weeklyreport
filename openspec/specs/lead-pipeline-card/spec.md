# lead-pipeline-card Specification

## Purpose

TBD - created by archiving change rethink-pipeline-state-vs-completeness. Update Purpose after archive.

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

(Direction captured from live-walk feedback; the exact completeness rule and
the completeness affordance are open design questions in proposal.md.)

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
3. Because status is derived, the legacy "stage marked at-risk/blocked without a
   backing risk" warning MUST be removed — it can no longer occur.

#### Scenario: a risk is added in the Risks section

- **WHEN** a lead adds a blocker covering the Development stage
- **THEN** the Development chip and the product left edge show blocked
  immediately, with no separate sync action

#### Scenario: a stage is covered by both a risk and a blocker

- **WHEN** one stage is covered by an at-risk AND a blocker risk
- **THEN** the displayed stage status is blocked (highest severity)
- **AND** both covering risks remain visible in the Risks section

### Requirement: Own-input completeness counts only stages the lead explicitly set

Own-input completeness (D1) MUST count a stage as addressed when EITHER
the lead set an explicit non-empty status on it OR the stage is covered
by the current lead's OWN non-empty staged risk. A risk is the lead's
input about that stage, so a stage the lead never explicitly set still
counts when their own risk covers it. The counter MUST be derived from a
`coveredByOwnRisk` annotation placed on the raw stage by the read-model
mapper (`mapLeadProducts` in `apps/web/src/lib/mappers/lead-form.ts`),
where `computeCompleteness` counts a stage when
`status !== "empty" || coveredByOwnRisk`. Two cases MUST NOT inflate the
counter:

1. A foreign or cross-author covering risk MAY color the chip (display
   floor) but MUST NOT set `coveredByOwnRisk` and MUST NOT count toward
   this lead's completeness — another lead's risk never finishes this
   lead's input.
2. A stage-less legacy risk (empty `stageIds`) MUST contribute ZERO. The
   annotation MUST NOT reuse the display-floor `riskCoversStage`
   predicate that treats an empty `stageIds` as covering all stages; a
   stage-less risk covers no stage for completeness.

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

#### Scenario: a stage-less legacy own risk counts zero

- **WHEN** the lead has an own risk with an empty `stageIds` array and no
  explicit status is set on any of the lead's stages
- **THEN** the legacy risk contributes zero to completeness
- **AND** the counter does not treat the empty `stageIds` as covering
  every stage

### Requirement: The pipeline chip distinguishes risk-covered from explicit status

A stage chip MUST visually distinguish risk-covered from explicit
status. The chip in `SdlcPipeline`
(`apps/web/src/components/lead/sdlc-pipeline.tsx`) MUST visually
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

The `+N more` collapsed-stages indicator MUST reveal the hidden stages through the shared Radix `Tooltip` from `packages/ui` — the same component the stage chips use — as a multi-line list (one stage per line), and MUST distinguish an owned-but-unstatused stage from a vacant one so it never mislabels an occupied stage as empty.

1. On pointer hover/focus the indicator MUST show the hidden stages through the
   shared Radix tooltip, one stage per line; the custom `useSdlcTooltip` is no longer
   used for the pipeline.
2. A hidden stage that is OWNED by another author MUST read as that owner plus an
   explicit "no status set" note when the lead has set no status; it MUST NOT read as
   "empty".
3. A hidden stage with no owner MUST read as "unassigned" (vacant).
4. The non-visual `aria-label` listing the hidden stages MUST be retained as the
   screen-reader path (the indicator is inert and not a keyboard tab stop).

#### Scenario: An owned hidden stage is not shown as empty

- **WHEN** a lead in Mine mode hovers the `+N more` indicator and a hidden stage is
  owned by another author with no status set
- **THEN** that line shows the owner and "no status set"
- **AND** it does not read as "empty"

#### Scenario: A vacant hidden stage reads as unassigned

- **WHEN** a hidden stage has no owner
- **THEN** its line reads "unassigned"

#### Scenario: The reveal is multi-line through the shared Radix tooltip

- **WHEN** the indicator is hovered
- **THEN** the hidden stages appear one per line via the shared Radix `Tooltip`
- **AND** moving the pointer away hides it

### Requirement: The collapsed-stages indicator surfaces the worst hidden severity

The `+N more` collapsed-stages indicator MUST color its border and text by the full status scale of the hidden stages, by precedence, so the product's left health stripe is traceable to the collapsed stages at a glance.

1. The color precedence MUST be: red when any hidden stage is `blocked`; otherwise
   yellow when any is `at-risk`; otherwise grey when any is unfilled
   (`empty`/unassigned); otherwise green when every hidden stage is `on-track`.
2. This reverses the prior "neutral grey unless blocked/at-risk" behaviour: a
   fully on-track hidden set now reads green, and a partially unfilled set reads grey.
3. This color is derived from the same hidden-stage set the indicator reveals; it
   MUST NOT change product health (left stripe) or the own-input completeness counter.

#### Scenario: All hidden stages on-track color the indicator green

- **WHEN** a lead in Mine mode has hidden stages that are all `on-track`
- **THEN** the `+N more` indicator renders green
- **AND** the product health stripe and the `N/M Your stages` counter are unchanged

#### Scenario: An unfilled hidden stage colors the indicator grey

- **WHEN** the worst hidden stage is no worse than `on-track` but at least one hidden
  stage is `empty` or unassigned
- **THEN** the `+N more` indicator renders grey

#### Scenario: A hidden blocked stage colors the indicator red

- **WHEN** any hidden stage is `blocked`
- **THEN** the `+N more` indicator renders in the blocked status color
