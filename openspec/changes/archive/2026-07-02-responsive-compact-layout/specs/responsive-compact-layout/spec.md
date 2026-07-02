## ADDED Requirements

### Requirement: New Surfaces Define a Compact-Tier Layout on a Canonical Breakpoint Scale

Every new interactive surface SHALL define a layout at the compact (`<md`) tier and
SHALL use the Tailwind `sm/md/lg` scale with `md` as the single compact↔full boundary,
introducing no bespoke breakpoint or per-tier height tokens.

A surface MUST NOT be accepted as desktop-only. The breakpoint scale is the canonical one
already in the codebase; new custom tokens are forbidden (the no-magic-literal rule).

#### Scenario: A new surface ships with a compact layout

- **GIVEN** a new interactive surface
- **WHEN** it is reviewed for acceptance
- **THEN** it has a defined `<md` compact layout (not desktop-only)
- **AND** it uses the `sm/md/lg` scale with `md` as the compact↔full boundary

### Requirement: Compact-Tier Controls Meet the Touch-Target Floor

Every interactive control SHALL meet `--touch-target-min` (44px) at the compact tier,
even where its desktop cluster height is the denser `--toolbar-control-h` (32px).

This qualifies the single-shared-height contract to "within one viewport tier": the
shared height at the compact tier is the touch floor.

#### Scenario: A 32px desktop button floors at 44px on a phone

- **GIVEN** a toolbar icon button at the desktop 32px density
- **WHEN** it renders at the compact tier
- **THEN** its interactive target is at least `--touch-target-min` (44px)

### Requirement: No Horizontal Overflow at the Compact Width

Each page surface SHALL fit the viewport width with no horizontal scroll below `md`,
except the report toolbar's explicitly-scrollable control strip.

The scrollable toolbar strip is the narrow-width reachability floor and is the single
documented exception, so it does not read against the dashboard's absolute no-scroll
guarantee.

#### Scenario: A surface fits the phone width

- **GIVEN** a page surface rendered below `md`
- **WHEN** it lays out
- **THEN** it fits the viewport width with no horizontal scroll
- **AND** only the report toolbar control strip may scroll horizontally

### Requirement: The Mixed Viewport Floor Keeps Slides a Tablet+ Surface

The compact support floor SHALL be mixed — dense surfaces (slides, dashboard) supported
at tablet width (≥768) and the lead form and the C1 review surface at phone width (≥360)
— so slides remain a tablet-and-up surface with no phone slide idiom in this change.

Below the slide floor the report (non-slide) view is the phone experience. Changing a
slide into a stacked document on a phone is explicitly out of scope here (it would
inherit the `head-slide-density` screenshot-sign-off gate and is recorded as a future
ADR if ever chosen).

#### Scenario: Slides are not required on a phone

- **GIVEN** a phone-width viewport (<768)
- **WHEN** a user reaches a slide route
- **THEN** the slide presentation is a tablet+ surface (not reformatted into a phone document in this change)
- **AND** the lead form and review surface remain usable at phone width

### Requirement: The Review Surface Is One Responsive Layout

The C1 review surface's per-record comments SHALL render as one responsive layout — each
comment stacked beneath its anchor `Item`/`Risk`/`Decision` at every width — with no
duplicated record content and no narrow-width side rail.

This makes the C1 "stacked per-record comments without duplication" concrete at the
layout level; it leaves the locked `review-acknowledgement` behavior untouched.

#### Scenario: Comments stack under their record on a phone

- **GIVEN** a record carrying two reviewer comments on a phone-width viewport
- **WHEN** the review surface renders
- **THEN** the comments stack beneath the record
- **AND** the record content is not duplicated and there is no side rail

### Requirement: A Compact Density Baseline Applies at All Tiers Without Dropping Signals

Each report / slides / dashboard surface SHALL render at a defined compact density —
reduced non-signal chrome and padding — at all tiers, without dropping any status signal.

The desktop density is otherwise unchanged beyond this light trim (the viewport-only
reading); a per-user density toggle is out of scope.

#### Scenario: Compact density preserves status signals

- **GIVEN** a report surface at the compact density baseline
- **WHEN** it renders
- **THEN** non-signal chrome and padding are reduced
- **AND** every status signal (traffic light, badges) remains present
