## ADDED Requirements

### Requirement: Product overview epochs remain scoped to product disclosure

A retained product overview activation MUST affect product accordions only in product scope. Switching the same report page to lead scope MUST NOT replay a product epoch against co-owner product instances. Lead overview navigation MUST continue to preserve each product instance's default or manually chosen disclosure state. Existing product-scope repeat navigation, author-linked highlighting and instance-local identity MUST remain unchanged.

#### Scenario: Product navigation is retained while switching to lead scope

- **GIVEN** one content-bearing product has contributions from two leads
- **AND** the head activated its product overview card in product scope
- **WHEN** the same report page switches to lead scope without an author deep link
- **THEN** neither lead-scoped product instance is opened by the retained product epoch
- **AND** subsequent lead overview navigation preserves manual product disclosure choices
