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

### Requirement: Head-specific surfaces stay distinct from the lead idiom

The framed-card idiom MUST apply to the per-lead SECTION content only. The
multi-lead sidebar list, the per-lead readiness aside (score gauge +
readiness checklist), the portfolio metric tiles, the owner identity
header, and the `AgentReviewComingSoon` control are head-specific surfaces:
they MAY be restyled for visual consistency but MUST NOT be folded into or
replaced by the section-card grid. The head deck MUST keep the ability to
navigate across leads.

#### Scenario: the head opens the deck with multiple leads

- **WHEN** the head views a report with two or more lead sections
- **THEN** a navigable lead list/sidebar is present
- **AND** the selected lead's section content renders in framed cards
- **AND** the per-lead readiness aside still renders as a distinct review
  affordance, not as a section card

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
