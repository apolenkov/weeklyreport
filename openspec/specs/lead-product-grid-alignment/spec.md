# lead-product-grid-alignment Specification

## Purpose

TBD - created by archiving change fix-lead-product-grid-card-alignment. Update Purpose after archive.

## Requirements

### Requirement: Per-product slide cards align their section bands across a row

The lead PRODUCT-scope slide grid (`LeadProductGrid`, `apps/web/src/components/slides/lead-product-grid.tsx`) MUST align EACH of its five section bands — header, Current, Next, Risks, and Decisions — to a shared horizontal baseline across all cards in the same grid row, so the eye can scan across products and no block "floats". Risks and Decisions are SEPARATE bands (the previous merged "Risks+Decisions" band is removed): a card that has decisions but no risks MUST still hold its own Risks row so its Decisions row does not float up to where another card's Risks row sits. Alignment MUST be achieved with shared row tracks (CSS subgrid: the outer grid defines the row tracks and each card spans them via `grid-template-rows: subgrid` over five rows), NOT with a `flex` + `mt-auto` bottom-pin.

1. Every card MUST render ALL FIVE bands so the tracks line up across cards; a
   band with no content (including an empty Risks band or an empty Decisions
   band) MUST render a quiet empty placeholder, NOT collapse or be omitted.
2. The `mt-auto` bottom-pin MUST NOT be used — band alignment is carried by the
   shared row tracks, not by pushing one block to the card bottom.
3. The `MAX_VISIBLE_ITEMS` "+N more" truncation MUST be preserved on every
   bounded band (Current, Next, Risks, Decisions) so the shared tracks stay
   compact.
4. This rule covers the PRODUCT-scope grid only; the Summary view
   (`LeadUnifiedSlide`) is governed by `lead-slide-quadrants` and is out of scope.

#### Scenario: cards with uneven content align their bands

- **WHEN** the product grid renders two or more cards in a row whose Current/Next/Risks/Decisions counts differ
- **THEN** each card's Current, Next, Risks, and Decisions band each begin at the same vertical position across the row
- **AND** no card pins a block to the bottom with a variable gap above it

#### Scenario: a card missing one section still holds its band

- **WHEN** a product has decisions but no risks (or vice versa)
- **THEN** the empty section still renders as a quiet placeholder occupying its shared track
- **AND** the following section stays aligned with the same section on neighbouring cards rather than floating up

#### Scenario: a dense band stays bounded

- **WHEN** a product has more than `MAX_VISIBLE_ITEMS` records in a band
- **THEN** the band shows the first `MAX_VISIBLE_ITEMS` plus a "+N more" row
- **AND** the shared track sized to that band stays compact rather than expanding for every card
