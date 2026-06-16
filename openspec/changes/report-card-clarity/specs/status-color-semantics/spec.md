# status-color-semantics

## MODIFIED Requirements

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
