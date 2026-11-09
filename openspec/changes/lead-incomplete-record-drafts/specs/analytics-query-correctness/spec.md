## ADDED Requirements

### Requirement: Analytics communicates scoped publication omissions

`trafficLightHistory`, `periodComparison`, and `leadVelocity` MUST convey omission state from the winning frozen snapshot for each returned period and admitted section scope. Missing legacy metadata MUST mean unknown, not zero. Incomplete risks and decisions MUST NOT enter derived status, risk facts or aggregates; inaccessible section omissions MUST NOT affect the response.

#### Scenario: Filtered report has incomplete and complete risks

- **GIVEN** the winning snapshot includes an admitted section with complete risk facts and a frozen omission count for an incomplete blocked risk
- **WHEN** an authorized analytics query reads that period
- **THEN** its facts and status reflect only complete records and its omission state warns that records were excluded
- **AND** the incomplete risk has not contributed a status floor or aggregate

#### Scenario: Legacy and inaccessible sections

- **WHEN** analytics reads a legacy snapshot without omission metadata or excludes a section outside the caller's scope
- **THEN** legacy omission state is unknown rather than zero
- **AND** the response does not reveal the inaccessible section's omission count or existence

#### Scenario: Republished report wins

- **WHEN** analytics selects a republished report in effect for a period
- **THEN** omission state comes from that winning frozen snapshot and the existing winner and reopened-period rules remain unchanged

### Requirement: Analytics omission scope follows its winning facts

Analytics MUST choose its existing winning snapshot before applying lead and Product filters to omission metadata. Responses MUST retain disclosure even when no complete fact rows remain. No admitted publication means no publication metadata, not a claim of historical zero. Cached responses lacking the new disclosure contract MUST be recomputed.

#### Scenario: Product filter leaves only omissions

- **WHEN** the winning admitted section has one incomplete risk on Product A and no complete facts on A, and history selects A
- **THEN** the returned period has an A-scoped omission notice without inventing a traffic-light row or using another Product's count

#### Scenario: Empty comparison side

- **WHEN** no publication is admitted for one comparison side
- **THEN** that side retains null period metadata and no omission claim about an inaccessible or absent publication
