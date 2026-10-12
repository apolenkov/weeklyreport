## ADDED Requirements

### Requirement: Published Item occurrences preserve section-local lineage uniqueness

Published snapshot admission MUST preserve the existing Item section-local stableId uniqueness invariant before recovery/read projections. Distinct physical Item IDs MUST NOT share a stableId within one frozen section. The later duplicate MUST be identified deterministically. Cross-section/period lineage reuse and the separate physical record-type identity namespace MUST remain unchanged.

#### Scenario: Two frozen Items claim one section-local lineage

- **WHEN** a recovered published section contains distinct Item IDs with the same stableId
- **THEN** snapshot and admin period admission reject the later Item at its stableId field before restore

#### Scenario: Lineage continues in another section or period

- **WHEN** distinct sections, authors or publication periods reuse a lineage stableId
- **THEN** that reuse remains valid when physical record identities are distinct
- **AND** risks and decisions do not acquire an Item-only uniqueness rule
