## REMOVED Requirements

### Requirement: Head-specific surfaces stay distinct from the lead idiom

**Removed because:** Superseded by the carousel + fullscreen navigation model
(ADR 0004, user direction 2026-06-22). This requirement kept a left multi-lead
sidebar and a separate right SLIDE COMPLETION / readiness aside, and forbade
folding them into the slide. The new model replaces the sidebar with a top
carousel and folds the readiness aside into the active slide, so the
"stay distinct / sidebar MUST NOT be folded" constraint no longer holds. The
remaining `head-slide-density` requirements (framed cards, neutral headers,
token-only colors, recorded sign-off) are unchanged.

## ADDED Requirements

### Requirement: The head deck navigates via a top carousel

The head status deck MUST present its slides as a horizontal carousel of slide
cards above the active slide, NOT as a left sidebar list. The carousel MUST
group its slides by the current scope (Product vs Leads) and MUST keep the deck
navigable across all slides (selecting a carousel card, plus the existing
arrow-key navigation). Selecting a carousel card MUST make that slide the active
fullscreen slide.

#### Scenario: the head opens the deck with multiple slides

- **WHEN** the head views a report with two or more slides in the current scope
- **THEN** a horizontal carousel of slide cards renders above the active slide
- **AND** there is no left sidebar list
- **AND** selecting a carousel card or pressing the arrow keys changes the
  active slide

#### Scenario: scope drives the carousel slide set

- **WHEN** the head switches the scope between Product and Leads
- **THEN** the carousel re-groups its slide cards to match the selected scope
- **AND** the head still sees every lead's data (the data scope is unchanged by
  the navigation model)

### Requirement: The active head slide fills the viewport like the lead deck

The active head slide MUST render as a full-viewport presentation surface,
reusing the same fullscreen affordance the lead deck uses (the shared
`DeckFullscreenOverlay` exit pill + ESC hint), keeping the framed-card section
grid and a discoverable exit-fullscreen affordance. The head MUST NOT be trapped
in fullscreen without a visible exit path, and arrow-key navigation across slides
MUST be preserved.

#### Scenario: the head opens a slide

- **WHEN** the head selects a slide from the carousel
- **THEN** the active slide fills the viewport like the lead deck
- **AND** a visible exit-fullscreen control returns the head to the standard view
- **AND** the framed-card section grid (Current / Next / Risks / Decisions)
  renders inside it

### Requirement: Slide status renders exactly once per slide

The slide status (Blocked / Review / Ready) MUST render exactly once per slide.
The duplicate status badge that previously appeared both on the left sidebar
card and in the focused slide header MUST NOT recur.

#### Scenario: a slide has a status

- **WHEN** a slide resolves to a Blocked / Review / Ready status
- **THEN** that status badge renders exactly once on the surface
- **AND** it is not repeated in a separate list card and slide header

### Requirement: Readiness folds into the active slide

The per-slide readiness / completion signal MUST render inside the active slide
as a compact in-slide strip — the score and the readiness checklist that
previously lived in a separate right-hand SLIDE COMPLETION aside. The head deck
MUST NOT render a separate side panel that the lead deck lacks.

#### Scenario: the head views a slide's readiness

- **WHEN** the head views the active slide
- **THEN** the readiness score and checklist render inside the slide as a
  compact strip
- **AND** there is no separate right-hand completion panel beside the slide

#### Scenario: a slide has no readiness items

- **WHEN** the active slide has zero readiness checklist items
- **THEN** the readiness strip renders a quiet placeholder or is hidden
- **AND** it MUST NOT render an empty block

### Requirement: The Agent review placeholder occupies a fixed slide-header slot

The inert `AgentReviewComingSoon` placeholder on the head slide MUST occupy a
fixed slot in the slide header and MUST NOT float over or overlap other slide
chrome. It MUST stay the inert ComingSoonBadge pattern (aria-disabled, no click
handler, tooltip); the hover "is there anything for me" behavior is the deferred
Agent-review feature and MUST NOT be built here.

#### Scenario: the head slide renders the Agent review placeholder

- **WHEN** the active head slide renders
- **THEN** the Agent review placeholder sits in a fixed slide-header slot
- **AND** it does not overlap the readiness strip or other slide chrome
- **AND** it remains aria-disabled with the ComingSoonBadge tooltip and no real
  Agent-review behavior
