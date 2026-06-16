# status-color-semantics

## MODIFIED Requirements

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

## ADDED Requirements

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
