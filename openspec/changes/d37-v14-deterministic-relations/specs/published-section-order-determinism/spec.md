## ADDED Requirements

### Requirement: Canonical section relations use current keys followed by identity

Canonical live and frozen report-section projections MUST preserve the mapper's existing Russian activity-name comparison, with ascending activityId used only when that name comparison is equal. Each activity's linkedProducts MUST preserve the existing Russian product-name comparison, with ascending productId used only for equal-name ties. The shared sectionReviews query MUST request ascending createdAt, then ascending reviewerId for equal timestamps. The identity tie-break MUST NOT be interpreted as creation time, chronology or recency. These orders MUST NOT depend on physical relation retrieval order for equivalent unique-identity records.

#### Scenario: Activity and linked-product names collide

- **GIVEN** two unique activities with equal names and two unique linked products with equal names
- **WHEN** equivalent relation inputs arrive in opposite physical orders
- **THEN** the actual canonical live mapper and frozen projection produce the same activity and linked-product identity order
- **AND** distinct names retain their existing primary name priority even when their IDs sort in the opposite order

#### Scenario: Review timestamps collide

- **WHEN** the shared report-section read queries reviews with equal createdAt values
- **THEN** the query requests reviewerId as an ascending tie-break after createdAt
- **AND** differing timestamps retain chronological createdAt priority without treating reviewer IDs as timestamps
