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

### Requirement: SDLC pipeline arrows center on the stage chip box

The connector arrow between SDLC stage chips MUST be vertically
centered on the chip box itself — not on the chip-plus-assignee-label
column. Consumer surface: `apps/web/src/features/period/ui/sdlc-pipeline.tsx`
with `stage-chip.tsx`, reused by the read-only head/report surfaces. The
chip box and the arrow box MUST derive their height from one shared
named constant (the same single-height-token property this capability
already fixes for control clusters), so the alignment holds by
construction with and without assignee names. Within one flex-wrap
row, chip boxes MUST share a common top edge; variable-height assignee
labels hang below the chip box and MUST NOT shift the chip or the
arrow vertically.

#### Scenario: stages render with assignee names below the chips

- **WHEN** the pipeline renders a product whose stage chips carry
  assignee labels (named or "— unassigned")
- **THEN** each connector arrow's vertical midline matches the
  adjacent chip box's vertical midline
- **AND** the chip and arrow boxes carry the same shared height value

#### Scenario: the stages row wraps on a narrow viewport

- **WHEN** the flex-wrap stages row breaks into multiple rows
- **THEN** on every wrap row the chip boxes share a common top edge
- **AND** every arrow stays centered on the chip box, regardless of
  which stages carry assignee labels

### Requirement: Remaining compact-viewport actions meet the touch floor

Below 48 rem, each segment of the report view-mode toggle, the development-only
role-switcher trigger and its interactive menu items, and every admin-user row
action in the corresponding `apps/web` React surfaces MUST render at least 44
by 44 CSS pixels. Labels, selected state, navigation, dropdown behavior, and
compact desktop geometry MUST remain unchanged.

#### Scenario: Lead changes report view on a phone

- **WHEN** Edit and Slides segments are visible below 48 rem
- **THEN** each interactive segment measures at least 44 by 44 CSS pixels
  without root overflow

#### Scenario: Administrator uses user-row actions on a phone

- **WHEN** Edit, Activate or Deactivate, and More actions are visible below 48
  rem
- **THEN** every action measures at least 44 by 44 CSS pixels while the
  intentionally scrollable table stays contained

#### Scenario: Dev role switcher is enabled

- **WHEN** the development-only role switcher appears below 48 rem
- **THEN** its trigger and every interactive role, reseed, and logout menu item
  measure at least 44 by 44 CSS pixels and preserve their menu semantics
- **AND** its menu remains within the viewport at 280 CSS pixels wide
- **AND** a failed logout or reseed re-enables the trigger before returning
  keyboard focus to it
