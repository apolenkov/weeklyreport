## ADDED Requirements

### Requirement: The product accordion MUST read ranked Next Week items in rank order

The product accordion MUST list Next Week items in the same order as Current
Week items: ascending `priorityRank`, items without a rank after ranked items,
ties and unranked items in source order.

#### Scenario: Next Week items carry ranks out of source order

- **GIVEN** a product whose Next Week items arrive as rank 2, unranked, rank 1
- **WHEN** the accordion renders the Next Week section
- **THEN** the items read rank 1, rank 2, unranked
