## ADDED Requirements

### Requirement: Regression Test Covers Archive Cross-Group Section Isolation

The archive repository's group-scoped section filter MUST have regression
test coverage proving that a lead or head session scoped to one reporting
group reads only that group's sections from a report whose sections span
multiple groups, on BOTH the snapshot-hit read path and the no-snapshot
fallback read path. A test suite where every existing archive repository
call omits a scoped session MUST NOT be considered sufficient coverage for
this filter.

#### Scenario: scoped session reads only its group's sections from a published snapshot

- **GIVEN** a published, archived report whose sections span reporting group
  A and reporting group B, with a persisted `publishedSnapshot`
- **WHEN** the archive repository is called with a session scoped to group A
- **THEN** the returned sections and recomputed `portfolioOverview` reflect
  only group A's records, with no group-B data present

#### Scenario: scoped session reads only its group's sections on the fallback path

- **GIVEN** a published, archived report whose sections span reporting group
  A and reporting group B, with no persisted `publishedSnapshot`
- **WHEN** the archive repository is called with a session scoped to group A
- **THEN** the fallback graph load returns only group A's sections, and the
  returned `portfolioOverview` reflects only group A's records

#### Scenario: the filter is symmetric across groups

- **GIVEN** the same multi-group report as above
- **WHEN** the archive repository is called with a session scoped to group B
  instead of group A
- **THEN** the returned sections and `portfolioOverview` reflect only group
  B's records
