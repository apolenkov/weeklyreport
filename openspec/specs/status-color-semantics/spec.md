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
stripe / dedicated marker), SDLC group surfaces, preview-card rows and badges.
The **stage chip is an identity surface, not a status surface** — it names the
SDLC stage with one uniform treatment and MUST NOT encode the item's workflow
status in its fill. A new status surface MUST reuse the existing status tokens or
add a named token — it MUST NOT introduce a hardcoded color literal.

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
