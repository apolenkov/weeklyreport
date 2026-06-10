## Purpose

The 2026-06-10 design-polish walk-through found that horizontal control
clusters (the admin users-tab filter row, the head Status Report header)
had drifted into per-control ad-hoc heights, and that color changes were at
risk of landing without the research step the repo "Visual And Theme Work"
rule requires. This capability fixes two durable properties established by
the `polish-ui-density-and-palette` change: grouped controls share one
height token, and palette work stays research-gated. It governs visual
consistency properties, not a code module.

## Requirements

### Requirement: Grouped interactive controls in one row share a consistent height

Interactive controls grouped in one horizontal cluster MUST render at a single
consistent control height drawn from a shared height token, not per-control
ad-hoc heights. This applies to clusters such as a filter row or a header action
bar (buttons, selects, inputs together). It is the durable property the admin
users-tab filter row and the head Status Report header fixes establish, and it
MUST NOT regress. Adjusting layout to satisfy this MUST NOT remove any control
from the keyboard tab order or change its operability (see
`a11y-regression-coverage`).

#### Scenario: a filter/action row renders at one height

- **WHEN** a horizontal cluster contains a mix of buttons, selects, and inputs
- **THEN** every control in the cluster shares the same rendered height
- **AND** each control remains keyboard-focusable and operable

### Requirement: Color/palette changes stay research-gated

Any change to background, accent, or theme color tokens MUST be preceded by an
approved research memo with concrete options and a chosen direction (the repo
"Visual And Theme Work" rule). A proposal MAY explore and recommend palette
options, but MUST NOT implement CSS color/background/theme tokens without an
explicit user sign-off recorded in the change.

#### Scenario: a palette item ships options before code

- **WHEN** a change identifies an undesirable color/background
- **THEN** it delivers a research memo with options and a recommendation
- **AND** no CSS color/background/theme token is edited until the user approves a
  direction
