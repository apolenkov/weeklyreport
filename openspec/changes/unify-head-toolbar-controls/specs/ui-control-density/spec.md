## MODIFIED Requirements

### Requirement: Grouped interactive controls in one row share a consistent height

Interactive controls grouped in one horizontal cluster MUST render at a single
consistent control height drawn from a shared height token, not per-control
ad-hoc heights. This applies to clusters such as a filter row or a header action
bar (buttons, selects, inputs together). It is the durable property the admin
users-tab filter row and the head Status Report header fixes establish, and it
MUST NOT regress. Adjusting layout to satisfy this MUST NOT remove any control
from the keyboard tab order or change its operability (see
`a11y-regression-coverage`).

Exception: an inert deferred-feature placeholder (aria-disabled, no click
handler, ComingSoonBadge pattern — see `head-toolbar-semantics`) MAY render
compact, below the cluster height. The requirement's intent is hittable
interactive targets; a non-interactive placeholder is not one. The exception
applies ONLY while the control is inert — the moment the feature activates,
the control MUST adopt the cluster height.

#### Scenario: a filter/action row renders at one height

- **WHEN** a horizontal cluster contains a mix of buttons, selects, and inputs
- **THEN** every control in the cluster shares the same rendered height
- **AND** each control remains keyboard-focusable and operable

#### Scenario: a cluster contains an inert deferred placeholder

- **WHEN** a horizontal cluster contains real actions and an aria-disabled
  ComingSoonBadge placeholder
- **THEN** the real actions share the cluster height
- **AND** the placeholder MAY render compact below that height
- **AND** activating the deferred feature restores the placeholder's control
  to the cluster height
