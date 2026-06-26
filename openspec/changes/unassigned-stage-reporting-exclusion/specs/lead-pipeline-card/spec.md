# lead-pipeline-card Specification (delta)

## ADDED Requirements

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
through owned stages today, so a stage nobody owns never drove the traffic light;
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

## MODIFIED Requirements

### Requirement: The pipeline shows only the lead's own stages in Mine mode

The lead SDLC pipeline MUST scope which stage chips render to the visibility mode, so that Mine reads as the lead's own contribution and Everyone shows the fuller team picture, without changing the health or completeness signals.

1. In **Mine** mode the pipeline MUST render only the stages the current lead
   owns. Stages owned by another author MUST NOT render inline — they are hidden,
   not greyed. A stage with no assignment on the product is NOT part of the
   product's stage set (see "Unassigned stages are excluded from a product's
   pipeline") and therefore never renders in any mode.
2. In **Everyone** mode the pipeline MUST render the lead's own stages plus the
   stages owned by other authors (the existing locked chips). It MUST NOT render
   an "unassigned"/vacant chip — an unassigned stage is excluded from the
   product's stage set, not greyed.
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

- **WHEN** a lead views a product in Mine mode where they own two of the
  product's assigned stages and other authors own the rest
- **THEN** only the two owned stage chips render; the other stages do not appear

#### Scenario: Everyone reveals foreign-owned stages, not vacant ones

- **WHEN** the same lead switches that product to Everyone mode
- **THEN** the two owned chips plus the foreign-owned (locked) chips render,
  showing the full pipeline of the product's assigned stages
- **AND** no "unassigned"/vacant chip appears — unassigned stages are excluded
  from the product's stage set

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

- **WHEN** a lead views a product in Mine mode where they own some of the
  product's assigned stages and the rest are hidden by the filter
- **THEN** the card shows a small inert indicator that the remaining stages are
  collapsed
- **AND** hovering the indicator reveals those hidden stages' names and statuses
- **AND** the same hidden-stage statuses are exposed non-visually through the
  indicator's accessible label, not by visual hover alone

#### Scenario: no indicator when the lead owns every stage

- **WHEN** a lead views a product in Mine mode where they own all of its assigned
  stages
- **THEN** no stage is hidden, so the collapsed-stage indicator does NOT appear

#### Scenario: the indicator never appears in Everyone mode

- **WHEN** the lead switches a product with hidden Mine-mode stages to Everyone
  mode
- **THEN** the full grid renders and the collapsed-stage indicator is NOT shown

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
2. This reverses the prior "neutral grey unless blocked/at-risk" behaviour: a
   fully on-track hidden set now reads green, and a partially unfilled set reads grey.
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
