## Purpose

The 2026-06-10 lead "Own" slide redesign (`redesign-lead-slide-quadrants`,
concept B, four live feedback rounds, user-accepted) rebuilt the lead slide
into a strict, framed, neutral density idiom. This capability carries that
accepted idiom over to the head-role status deck so the two surfaces read as
one product: `HeadSlideArticle`
(`apps/web/src/components/slides/status-slide-deck.tsx`) renders the per-lead
section content as framed, floored cards with neutral section headers,
token-driven left stripes, dashed empty-section placeholders, and no
count-based truncation. The durable `lead-slide-quadrants` spec governs only
the lead "Own" slide and lists the head slide as a Non-goal; this is the
parallel head contract. It governs the head slide surface, not a code module.

The head-specific surfaces — the multi-lead sidebar, the per-lead readiness
aside, the portfolio metric tiles, the owner identity header, and the
`AgentReviewComingSoon` control — stay distinct and are not folded into the
section-card grid. No new color token is introduced; every accent resolves
through an existing `--color-*` token.

## Requirements

### Requirement: The head status slide renders each section as a framed, floored card

`HeadSlideArticle` MUST render the per-lead section content (Current work,
Next focus, Risks, Decisions) as framed cards
(`apps/web/src/components/slides/status-slide-deck.tsx`) using the existing
slide-card recipe (existing border, radius, and surface tokens) — NOT as
the current free-flowing `xl:grid-cols-2` block of bare `<section>`s. Each
card MUST hold a per-card minimum height
drawn from a named dimension token so the layout does not collapse at
sparse density or sprawl at heavy density. An empty section MUST render a
framed dashed-border placeholder with section-specific copy — it MUST NOT
be conditionally hidden or collapse to a bare header. The deck's
exit-fullscreen affordance MUST be preserved.

#### Scenario: a lead's section has no items

- **WHEN** the selected lead's slide model has zero rows for a section
- **THEN** that section still renders as a framed card at the minimum
  height
- **AND** a dashed placeholder names the empty state

#### Scenario: a lead's section is dense

- **WHEN** the selected lead has many rows in one section
- **THEN** every row renders with no count-based truncation
- **AND** the head deck does not push subsequent chrome off-screen — the
  decisions overflow stays reachable via scroll inside the card

### Requirement: Head section headers are neutral with token-driven stripes

Head section headers on `HeadSlideArticle` MUST render neutral (muted
foreground, hierarchy via typography weight). The hue currently on the
Risks header (`--color-destructive`) and the Decisions header
(`--color-starbucks-accent`) MUST move off the label onto a per-card left
status stripe drawn from a named token: Current →
`--color-chip-on-track-border`, Next → `--color-primary`, Risks →
`--color-chip-at-risk-border`, Decisions → `--color-decisions-accent`.
This mirrors the lead idiom (`lead-unified-slide.tsx`) and satisfies
`status-color-semantics` (section labels neutral; red reserved for blocked;
amber as the at-risk accent).

#### Scenario: the head slide renders mixed-status sections

- **WHEN** `HeadSlideArticle` renders the four sections together
- **THEN** all section headers render in neutral foreground/muted colors
- **AND** each card's accent is carried only by its left stripe
- **AND** red appears on the head slide only for blocked status, never on
  a section label

### Requirement: Head slide colors stay inside the existing token system

`HeadSlideArticle` MUST resolve any status color it renders (stripe,
accent, badge, dot) through an existing named `--color-*` token, per
`status-color-semantics`. This change MUST NOT introduce a new color token
or a hardcoded hex/rgba status literal; gold stays reserved for the
priority chip; amber stays the at-risk accent.

#### Scenario: a head card renders its accent color

- **WHEN** a head section card renders its stripe or any status accent
- **THEN** the color resolves through an existing named token
- **AND** no new color token and no hardcoded status literal is added

### Requirement: The head-slide redesign ships only with recorded sign-off and visual acceptance

A change implementing `head-slide-density` MUST reference the recorded user
decisions that settled the design Open Questions (grid shape, attribution,
and the rest), because those are deliberately left as taste decisions, and
MUST present same-viewport before/after screenshots for user review
before the change is archived — covering one-lead, many-leads,
empty-section, dense-decisions, and fullscreen states.

#### Scenario: a head-slide redesign implementation lands

- **WHEN** a change edits `HeadSlideArticle` density or layout
- **THEN** it cites the recorded user decisions for the open taste
  questions
- **AND** before/after screenshots across the listed states are produced
  for user acceptance before archiving

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
