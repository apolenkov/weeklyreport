## ADDED Requirements

### Requirement: Per-product slide cards align their section bands across a row

The lead PRODUCT-scope slide grid (`LeadProductGrid`, `apps/web/src/components/slides/lead-product-grid.tsx`) MUST align its section bands — header, Current, Next, and Risks+Decisions — to a shared horizontal baseline across all cards in the same grid row, so the eye can scan across products and no block "floats". Alignment MUST be achieved with shared row tracks (CSS subgrid: the outer grid defines the row tracks and each card spans them via `grid-template-rows: subgrid`), NOT with the previous `flex` + `mt-auto` bottom-pin which left the Current/Next bands and the gap above the bottom block unaligned.

1. Every card MUST render ALL FOUR bands so the tracks line up across cards; a
   band with no content MUST render a quiet empty placeholder, NOT collapse or be
   omitted (the previous conditional `hasRisks || hasDecisions` block is removed).
2. The `mt-auto` bottom-pin MUST be removed — band alignment is carried by the
   shared row tracks, not by pushing one block to the card bottom.
3. The `MAX_VISIBLE_ITEMS` "+N more" truncation MUST be preserved — it bounds each
   band's height so the shared tracks stay compact.
4. This rule covers the PRODUCT-scope grid only; the Summary view
   (`LeadUnifiedSlide`) is already level via `auto-rows-fr` and is out of scope.

#### Scenario: cards with uneven content align their bands

- **WHEN** the product grid renders two or more cards in a row whose Current/Next/Risks/Decisions counts differ
- **THEN** each card's Current band, Next band, and Risks+Decisions band begin at the same vertical position across the row
- **AND** no card pins a block to the bottom with a variable gap above it

#### Scenario: an empty band still holds its track

- **WHEN** a product has no risks and no decisions
- **THEN** that card still renders the Risks+Decisions band as a quiet empty placeholder occupying the shared track
- **AND** the band does not collapse, so neighbouring cards' bands stay aligned

#### Scenario: a dense band stays bounded

- **WHEN** a product has more than `MAX_VISIBLE_ITEMS` records in a band
- **THEN** the band shows the first `MAX_VISIBLE_ITEMS` plus a "+N more" row
- **AND** the shared track sized to that band stays compact rather than expanding for every card
