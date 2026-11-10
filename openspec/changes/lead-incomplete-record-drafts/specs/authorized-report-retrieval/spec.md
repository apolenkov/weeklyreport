## MODIFIED Requirements

### Requirement: Candidate projection is immutable and non-persistent

After source selection and authorization, a pure projector MUST create a discriminated `SearchCandidate` union for Item, Risk, Decision, Product status, Stage status, and Activity status. Candidate occurrences MUST retain report, section, author, subject, period, record identity, and optional lineage identity. Candidate projection MUST NOT persist a search-document copy of report text and MUST NOT deduplicate carry-over occurrences across reports.

The ordinary assistant projection MUST exclude incomplete risks and decisions before candidate creation, risk-derived statuses and aggregates, including for an author’s own section. After the existing authorization and subject scope, the assistant response MUST disclose scoped omissions separately from search matches without disclosing incomplete text. Missing historical omission metadata MUST be reported as unknown, not zero.

#### Scenario: A carried Item appears in four reports

- **WHEN** one lineage appears as four authorized report occurrences
- **THEN** projection produces four distinct candidates with the shared lineage retained separately

#### Scenario: A foreign section reaches projection

- **WHEN** projection receives a foreign visible section occurrence
- **THEN** that occurrence has already passed the shared-product lens and contains no private foreign fields

#### Scenario: Incomplete risk in an authorized live section

- **GIVEN** an authorized live section contains an incomplete blocked risk and a complete risk
- **WHEN** assistant retrieval projects and aggregates candidates
- **THEN** only the complete risk becomes a candidate and the incomplete risk does not floor derived status
- **AND** the assistant discloses scoped omissions without the incomplete text

#### Scenario: Foreign inaccessible omissions and legacy metadata

- **WHEN** a request includes a foreign section outside its authorized subject lens or a legacy snapshot without omission metadata
- **THEN** inaccessible omissions do not affect counts or disclose existence
- **AND** the legacy omission state is unknown rather than zero

## ADDED Requirements

### Requirement: Assistant omission notice describes selected authorized sources

Assistant disclosure MUST use selected periods and authorized author/subject/stage/kind scope before text or semantic matching and result truncation. It MUST be labelled corpus coverage, not a count of matching missing facts. Incomplete text MUST NOT enter candidates, embeddings or answer grounding. Empty exact results retain `no_results` and MUST NOT request an embedding.

#### Scenario: No result with scoped omissions

- **WHEN** exact filters yield no complete candidates in an authorized selected corpus with incomplete decisions
- **THEN** the response retains `no_results`, adds the corpus coverage notice and makes no semantic or answer claim about those decisions
- **AND** no inaccessible subjects become entity clarification options from omission metadata

#### Scenario: Resolved filters narrow coverage independently of matches

- **WHEN** a request selects an author, Product or Activity, stage set, or record kind
- **THEN** coverage includes only omission buckets admitted by those same resolved filters and the current authorization lens
- **AND** a record covering multiple selected stages contributes once
- **AND** linked Activity inclusion uses the same readable Activity links as candidate filtering

#### Scenario: No incomplete-capable kind or no resolved corpus

- **WHEN** the request excludes both risks and decisions, or a requested entity cannot be resolved from the readable catalog
- **THEN** the response carries known-zero omission coverage
- **AND** private omission buckets do not supply an entity or broaden the request

#### Scenario: Legacy unknown respects the selected authorization scope

- **WHEN** a selected readable scope predates omission metadata
- **THEN** its omission coverage remains unknown
- **AND** an author or foreign Product outside the selected authorized scope contributes neither counts nor unknown state
