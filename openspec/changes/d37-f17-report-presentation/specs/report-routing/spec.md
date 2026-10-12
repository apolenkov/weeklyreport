## ADDED Requirements

### Requirement: Author targets belong to displayed scope-specific products

The author deep-link target MUST belong to the actually displayed Product collection or, in Leads, the focused author's actually displayed lead group. Highlight and delayed scroll MUST use that same rendered instance. Missing visible content MUST yield no product target. Explicit overview navigation and full report summaries MUST remain unchanged.

#### Scenario: Draft content is hidden by the submission filter

- **GIVEN** an author's content-bearing product is only in a draft section
- **WHEN** the submitted-only body renders in Product or Leads scope
- **THEN** no hidden draft product is selected as author target
- **AND** Show all restores its eligibility as a visible target

#### Scenario: A co-owner contributes only to a different product

- **GIVEN** submitted Alice and Bob co-own Alpha, with Alpha content only from Alice
- **AND** Bob's own content is in Beta while aggregate Alpha sorts first
- **WHEN** author Bob is opened in Leads scope
- **THEN** Bob's Beta instance is expanded and receives the delayed scroll request
- **AND** no nonexistent Bob Alpha instance is targeted
- **AND** Product scope may select visible aggregate Alpha
