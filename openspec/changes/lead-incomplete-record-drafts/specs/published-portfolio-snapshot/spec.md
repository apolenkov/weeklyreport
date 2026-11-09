## MODIFIED Requirements

### Requirement: Frozen referenced Products remain in published display membership

`buildPortfolioProductsFromSnapshotSections` SHALL include each Product named
by a frozen section's `referencedProjects` in the published portfolio's
display-only membership. A referenced-only Product SHALL use its frozen real
name, null health, zero stages, and empty health-contributing lead ids and
names. It MUST NOT contribute to published portfolio health totals or acquire
editable stage ownership.

When the same Product is stage-owned in any section, owned Product metadata
SHALL take precedence and the builder SHALL preserve its existing health,
stage-union, lead-attribution, deduplication, and totals behavior.

Only complete risk and decision records enter frozen display membership and portfolio derivation; incomplete records are removed before risk floors and aggregates. Referenced Product membership and complete records in unsubmitted sections otherwise retain their existing semantics.

#### Scenario: Referenced-only records survive Product and PDF projection

- **GIVEN** a frozen section has no stage-owned Product but names a Product in
  `referencedProjects`
- **AND** the section contains an item, risk, or decision parented to that Product
- **WHEN** the published portfolio and weekly-report Product projection are built
- **THEN** one Product card with the frozen real name contains those records
- **AND** its portfolio metadata has null health, zero stages, and no health-contributing leads

#### Scenario: Owned metadata wins over referenced metadata

- **GIVEN** one section stage-owns a Product and another section references the
  same Product with conflicting frozen metadata
- **WHEN** the published portfolio is built
- **THEN** the Product appears exactly once using the owned Product name
- **AND** only owned occurrences contribute health, stages, and lead attribution

#### Scenario: Incomplete risk cannot floor a portfolio

- **GIVEN** an unsubmitted frozen section has a complete referenced-Product decision and an incomplete blocked risk
- **WHEN** the publication projection is constructed
- **THEN** the complete decision and referenced Product remain visible
- **AND** the incomplete risk is absent before status and portfolio totals are computed
