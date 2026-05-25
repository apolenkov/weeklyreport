## ADDED Requirements

### Requirement: Product Separators Must Share a Common Baseline

Product-group separators on the status slide view MUST render at a
consistent vertical baseline relative to each product group. The
baseline rule (top-aligned with the product title OR center-aligned
per group) MUST be applied uniformly across all groups so the eye
flow remains predictable.

#### Scenario: Slide renders three product groups

- **WHEN** the status slide view renders 3+ product groups in a single deck
- **THEN** each product separator appears at the same vertical offset relative to its product title
- **AND** no group's separator sits at a different baseline than the others

#### Scenario: One product group has more items than the others

- **WHEN** product A has 2 items and product B has 7 items on the same slide
- **THEN** the separator after product A still aligns with the separator after product B (according to the chosen baseline rule — e.g., both top-aligned with the next product title)
- **AND** the asymmetric item count does not push the separator into a different vertical position
