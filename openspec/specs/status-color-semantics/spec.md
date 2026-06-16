## Purpose

The 2026-06-10 palette work (`apply-status-palette`, from the research memos
of `polish-ui-density-and-palette`) replaced a 7-hue "parrot" status surface
with a restrained system: tokens instead of hardcoded literals, one alarm
hue, reserved accents. This capability fixes those durable properties so
future status UI does not drift back. It governs status color usage, not a
code module.

## Requirements

### Requirement: Status colors come from named tokens

Semantic status colors MUST be drawn from named CSS tokens defined in the
design-system token block, not from hex/rgba literals inlined in components.
This covers status-bearing UI: the item row's workflow-status signal (left
stripe / dedicated marker), SDLC group surfaces, preview-card rows and badges,
**and the slide surfaces — the `status-slide-deck` status pill, the
`lead-slide-hero` tone badge, and the `lead-product-grid` `StatusBadge`**. The **stage chip is an identity surface,
not a status surface** — it names the SDLC stage with one uniform treatment and
MUST NOT encode the item's workflow status in its fill. A new status surface
MUST reuse the existing status tokens or add a named token — it MUST NOT
introduce a hardcoded color literal.

#### Scenario: a status surface renders its color

- **WHEN** a component renders a status-dependent color (fill, text, border,
  stripe)
- **THEN** the color resolves through a named `--color-*` token
- **AND** no new hardcoded hex/rgba status literal is added to the component

#### Scenario: a stage chip renders

- **WHEN** an item row renders its stage chip
- **THEN** the chip uses one uniform identity treatment regardless of the item's
  workflow status
- **AND** the workflow status is shown by the row's stripe/marker, not the chip

#### Scenario: a slide surface renders a status

- **WHEN** the `lead-slide-hero` tone badge, the `status-slide-deck` pill, or the
  `lead-product-grid` `StatusBadge` renders a workflow status
- **THEN** its fill, text, and border resolve through named `--color-*` tokens
- **AND** the same status renders the same color across all slide surfaces

### Requirement: One alarm hue with reserved accents

Red MUST appear only for the `blocked` state. Amber MUST appear only as the
at-risk accent (border stripe or chip border/fill per the approved memo
options), never as a section-label color. Gold (`--color-starbucks-gold`)
MUST remain reserved for priorities. Section labels in the preview card MUST
stay neutral, carrying hierarchy through typography weight, not hue.

#### Scenario: a preview card shows mixed content

- **WHEN** the section preview card renders labels, rows, and badges together
- **THEN** red appears only on blocked rows/badges
- **AND** at-risk rows are marked by the amber stripe/accent, not a flooded
  amber fill
- **AND** all section labels render in the neutral foreground/muted colors

### Requirement: Palette changes ship only with recorded sign-off and visual acceptance

A change implementing status-palette values MUST reference the recorded user
sign-off that authorized the direction, and MUST present same-viewport
before/after screenshots for user review before the change is archived.

#### Scenario: a palette implementation lands

- **WHEN** a change edits status color tokens or their application
- **THEN** it cites the sign-off record (change + task) authorizing the
  direction
- **AND** before/after screenshots are produced for user acceptance

### Requirement: One canonical color per status across slides

The slide surfaces MUST render a given workflow status with one canonical color
set, so the same status never appears as two different hues across the slides
experience. Blocked MUST use the `--color-status-blocked-bg` fill with
`--color-destructive` text; at-risk MUST use the `--color-status-at-risk-bg`
fill with `--color-status-at-risk-fg` text; on-track MUST use the
`--color-success` fill with `--color-primary` text. Borders MUST be
token-derived (a `color-mix` of the matching status token — `--color-destructive`
for blocked, `--color-status-dot-at-risk` for at-risk, `--color-starbucks-accent`
for on-track), never a raw literal. Amber MUST remain the at-risk accent only and
red MUST remain blocked-only.

#### Scenario: blocked appears on more than one slide surface

- **WHEN** a blocked item is shown in the `lead-slide-hero`, the
  `status-slide-deck` pill, and the `lead-product-grid` within the same report
- **THEN** all render blocked with the same red token set
- **AND** no slide surface shows a second, different red for blocked
