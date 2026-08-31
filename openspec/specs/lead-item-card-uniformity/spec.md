# lead-item-card-uniformity Specification

## Purpose

Keep lead section item cards at a uniform height while exposing truncated text through an accessible full-text tooltip.

## Requirements

### Requirement: Item cards in a section render at a uniform height

Every item card in a lead section MUST render at a uniform height within its
section, using the shared empty-state placeholder card as the height reference,
so a column of cards reads as an even grid rather than a ragged
one. The cards are `apps/web/src/features/report-sections/ui/item-card.tsx`, rendered within
`apps/web/src/shared/ui/report-shell/accordion-section.tsx`. A card with little content MUST pad to that
reference height rather than shrink; a card whose text would exceed it MUST NOT
grow past the reference height (its overflow is handled by the truncation
requirement). The current behaviour — a `min-height: 110` floor on a
content-growing flex column, which lets a long card outgrow a short one — MUST
become a shared reference height applied to populated and empty cards alike. The
uniform height MUST NOT clip a card's action row, status pill, author, or stage
tags; only the body text is subject to truncation.

#### Scenario: a short and a long card share one height

- **WHEN** a section renders one card with a single short line and another with
  several lines of text
- **THEN** both cards render at the same height
- **AND** neither card is shorter or taller than the section's empty-state
  reference card

#### Scenario: the empty-state card sets the reference

- **WHEN** a section renders its empty-state placeholder card alongside populated
  cards
- **THEN** the populated cards match the empty-state card's height

### Requirement: Overflowing item text truncates with an ellipsis and a full-text tooltip

Item card body text that exceeds the card's uniform height MUST truncate with an
ellipsis rather than expand the card, and the full untruncated text MUST stay
available on hover via a native `title` tooltip. The static
(non-editing) render already uses `line-clamp-3` + `title`; this requirement pins
BOTH halves so a later edit cannot drop the clamp (letting the card grow) or the
`title` (losing the full text). Truncation MUST apply only to the static render:
when a card enters inline edit, the edit textarea MUST show and accept the full,
untruncated text.

#### Scenario: long body text is clamped with a hover tooltip

- **WHEN** an item's text is longer than the card's uniform height allows
- **THEN** the visible text is clamped with an ellipsis and the card height is
  unchanged
- **AND** hovering the text shows the full untruncated text via its `title`
  tooltip

#### Scenario: editing a card shows the full text

- **WHEN** the lead opens a truncated card for inline edit
- **THEN** the edit textarea shows the full, untruncated text, not the clamped
  form
