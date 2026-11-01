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

### Requirement: Risk row action controls name the row non-emptily

The toggle-severity, edit and delete controls on a risk card MUST expose a
non-empty accessible name identifying the row, so a non-visual user gets the
same row identity a sighted user gets from the card title. When the stored
`productName` is empty or blank (for example an activity-parented row whose
activity name is unresolved), the label MUST fall back to the "Unknown"
placeholder of the lead-surface-name-resolution requirement "Lead-surface card
product names resolve report-wide" instead of dangling ("Edit risk for ").

#### Scenario: An activity-parented risk with an unresolved name

- **WHEN** a risk card renders with an empty or blank `productName`
- **THEN** its toggle, edit and delete controls expose names ending in the
  "Unknown" placeholder (for example "Edit risk for Unknown")
- **AND** the visible card title and the delete confirmation subtitle show the
  same "Unknown" name
- **AND** no action label ends in a blank
