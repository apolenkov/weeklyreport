## MODIFIED Requirements

### Requirement: Every overview activation repeats its destination action

Each activation of an active report overview card MUST be treated as fresh
navigation intent, including consecutive activations of the same card. In
product scope, explicit navigation MUST open the targeted content-bearing
product accordion and scroll it into view. A manual collapse after that
navigation MUST remain in effect through ordinary rerenders, and the next
explicit activation of that product's overview card MUST reopen and scroll it.
The activation MUST NOT reset another product accordion's local disclosure
state.

In lead scope, every activation MUST scroll to and focus the targeted lead
section, including repeated activation of the same lead. Lead navigation MUST
continue to leave product accordion disclosure states unchanged.

#### Scenario: Repeated product navigation follows a manual collapse

- **GIVEN** a user navigated to a content-bearing product from the overview and
  then manually collapsed its accordion
- **WHEN** the user activates the same product overview card again
- **THEN** that product accordion reopens and scrolls into view again
- **AND** unrelated product accordions retain their local disclosure state

#### Scenario: Ordinary rendering preserves a manual collapse

- **GIVEN** a user manually collapsed an overview-targeted product accordion
- **WHEN** the report rerenders without another overview activation for that
  product
- **THEN** the product accordion remains collapsed

#### Scenario: Navigating elsewhere preserves the previous product state

- **GIVEN** overview navigation opened one product and the user either retained
  that state or made an explicit disclosure choice
- **WHEN** the user activates another product overview card
- **THEN** the first product keeps its open or collapsed disclosure state
- **AND** the newly targeted product opens and scrolls into view

#### Scenario: Repeated lead navigation repeats focus and scroll

- **GIVEN** a user already navigated to a lead section from the overview
- **WHEN** the user activates the same lead overview card again
- **THEN** the page scrolls to and focuses that lead section again
- **AND** no product accordion is force-expanded or reset

#### Scenario: Mounted report focus changes after an overview activation

- **GIVEN** an overview activation selected a target on the current report
- **WHEN** the report identity or deep-link product focus changes while the report page stays mounted
- **THEN** the previous overview target and its activation epochs no longer override the current navigation context
- **AND** the fresh deep-link product focus takes effect
- **AND** ordinary rerenders with the same basis preserve the existing activation and manual-disclosure rules
