## ADDED Requirements

### Requirement: Owned frozen product labels take priority over references

A weekly published read built from an admitted frozen section MUST use its owned product name for that product's portfolio and risk escalation labels when same-section reference metadata has the same product ID. Reference-only labels, risk rows, global red deduplication and scope MUST retain their existing meaning.

#### Scenario: Recovered section includes stale reference metadata

- **WHEN** an admitted published section owns a product named Owned and references that same ID as Stale
- **THEN** its portfolio and risk escalation both use Owned

#### Scenario: Only reference metadata names the product

- **WHEN** the frozen risk's product has only reference metadata
- **THEN** its existing reference label remains authoritative
