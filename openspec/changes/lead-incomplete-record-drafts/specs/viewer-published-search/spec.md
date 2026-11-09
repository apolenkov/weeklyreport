## ADDED Requirements

### Requirement: Published search communicates scoped omissions

The viewer published search response and History search surface MUST disclose omission state for admitted published reports within the requested search scope, separately from matching hits. Frozen section group access applies to the notice. Legacy snapshots without omission metadata MUST produce unknown rather than zero. Incomplete risk and decision text MUST NOT enter the search projection.

#### Scenario: Omitted risk does not match

- **GIVEN** an admitted publication contains an omitted incomplete risk and a complete risk
- **WHEN** the viewer searches a term found only in the omitted risk
- **THEN** no hit exposes its text, and the search surface warns of scoped omissions rather than implying a complete corpus
- **AND** a matching complete risk remains searchable

#### Scenario: Inaccessible and legacy publications

- **WHEN** a viewer searches across publications including inaccessible sections and a legacy admitted snapshot without omission metadata
- **THEN** inaccessible omission counts and existence are not disclosed
- **AND** the admitted legacy omission state is unknown rather than zero

#### Scenario: Republish replaces omission information

- **WHEN** a reopened report is republished with changed omissions
- **THEN** published search uses the newly frozen scoped omission information and the existing atomic projection replacement rules

### Requirement: Published omission lookup stays indexed and hit-independent

Published search MUST obtain omission metadata from a scope-indexed frozen projection replaced atomically with snapshot and search documents, including restore. It MUST NOT load snapshots or mutable sections for disclosure. Corpus scope is admitted published sections before text matching or hit limits; missing legacy metadata is unknown, not zero.

#### Scenario: An omitted-only section has no search documents

- **WHEN** an admitted published section has omissions but no matching indexed document
- **THEN** its frozen omission metadata still contributes to the corpus notice
- **AND** the notice does not claim omitted text matched the query

#### Scenario: Restore without live rows

- **WHEN** recovery restores a valid snapshot and rebuilds its frozen projections without live sections
- **THEN** search disclosure matches the restored metadata, or unknown for legacy absence, without querying live records
