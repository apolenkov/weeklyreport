## MODIFIED Requirements

### Requirement: Slide Card Density Tokens Are Consistent Across the Deck

The status slide deck MUST apply the same values for its three density
tokens — outer card padding, section-header line-height, and inter-slide
gap — across every slide card. Changing a density token MUST affect all
slide cards in the deck simultaneously; no individual card MUST silently
override the shared value.

#### Scenario: Designer tightens slide padding

- **WHEN** a contributor changes the slide outer-padding token from `p-3` to `p-2`
- **THEN** every slide card in the deck (status, summary, decision) reflects the new padding
- **AND** no per-component override silently retains the old value
