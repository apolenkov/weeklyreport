## Purpose

Define how CustomReport React routes present programmatic focus on their shared
main landmark without exposing a browser-default full-surface outline or
weakening keyboard focus feedback for interactive controls.

## ADDED Requirements

### Requirement: Application main landmarks MUST support a visually intentional skip-link destination

Every rendered CustomReport React route reached by the root skip link MUST
expose exactly one `main-content` landmark that accepts programmatic focus. When
the skip link transfers focus to that landmark, the active element MUST remain
the main landmark, the browser viewport MUST expose its primary content context,
and the rendered application surface MUST NOT show the browser-default outline
around the full landmark boundary.

#### Scenario: Keyboard user follows the skip link

- **WHEN** a keyboard user focuses and activates the root `Skip to content`
  link on an application route
- **THEN** document focus moves to that route's `main-content` landmark
- **AND** the primary content heading or equivalent route context is exposed in
  the viewport
- **AND** no browser-default outline encloses the full application surface

#### Scenario: A route has multiple rendered main-content branches

- **WHEN** loading, error, empty, and populated branches of a React route are
  inspected
- **THEN** every rendered branch exposes one programmatically focusable
  `main-content` landmark
- **AND** every branch presents landmark focus without a browser-default
  full-surface outline

### Requirement: Landmark presentation MUST NOT weaken interactive focus feedback

The main-landmark focus presentation MUST be scoped to the programmatic
`main-content` destination. Links, buttons, form controls, tabs, menus, dialog
controls, and other keyboard-operable elements inside or outside the landmark
MUST retain a visible focus indicator bounded to the interactive control. This
landmark repair MUST NOT claim that every pre-existing route-local control
already uses the CustomReport design-system focus token.

#### Scenario: Focus advances from the landmark to an interactive control

- **WHEN** keyboard focus advances from `main-content` to the next
  keyboard-operable control
- **THEN** the control renders a visible focus indicator bounded to itself
- **AND** the landmark-only presentation rule does not suppress, mask, or
  replace that control's focus indicator

#### Scenario: Pointer interaction does not introduce a landmark outline

- **WHEN** a pointer user interacts with content after the main landmark was
  programmatically focused
- **THEN** the application continues to render without a full-surface landmark
  outline
- **AND** pointer interaction does not alter the keyboard focus contract of any
  interactive control

### Requirement: Main-landmark focus behavior MUST have source and real-browser regression evidence

The web regression gate MUST reject any rendered `main-content` branch that is
not programmatically focusable or does not participate in the shared landmark
presentation contract. Acceptance evidence MUST also exercise the real keyboard
skip-link path in Chrome at mobile, tablet, and desktop widths; a source scan,
unit test, axe result, or pointer-only screenshot alone MUST NOT be treated as
proof of the rendered focus state.

#### Scenario: A route drops the landmark presentation contract

- **WHEN** a rendered React route branch keeps `id="main-content"` but drops
  either programmatic focusability or the shared presentation contract
- **THEN** the source-level web regression gate fails and identifies the route
  source

#### Scenario: Browser evidence proves both focus and presentation

- **WHEN** the focus contract is verified at 375 px, 768 px, and 1280 px widths
  in real Chrome
- **THEN** each run proves that `main-content` is the active element after skip
  link activation
- **AND** each run proves the full-surface browser-default outline is absent
- **AND** each run proves at least one subsequent interactive control retains a
  visible focus indicator
