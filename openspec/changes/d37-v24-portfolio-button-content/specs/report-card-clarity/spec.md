## ADDED Requirements

### Requirement: Portfolio buttons use valid native content

Portfolio Lead and Product navigation buttons SHALL contain phrasing content permitted by the HTML button content model while retaining their existing content, activation and empty-product disabled behavior.

#### Scenario: Lead and active product cards

- **WHEN** the portfolio renders a Lead card or a Product card with report content
- **THEN** its native button contains valid phrasing descendants
- **AND** activation continues to request navigation to the corresponding Lead or Product

#### Scenario: Empty product card

- **WHEN** the portfolio renders a Product card with no report content
- **THEN** its native button contains valid phrasing descendants
- **AND** it remains disabled, displays No updates and does not request navigation
