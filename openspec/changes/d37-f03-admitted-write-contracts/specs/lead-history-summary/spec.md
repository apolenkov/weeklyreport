## ADDED Requirements

### Requirement: Issued history cursors match current UUID admission

Both personal-history and open-work-history cursors MUST accept report identity values admitted by the existing shared UUID schema, including restored UUID6/7/8 identities. Cursor coordinate format, chronology, source, date checks, author scope and frozen snapshot validation MUST remain unchanged. Malformed identities MUST retain existing typed cursor rejection before historical queries.

#### Scenario: A supported restored identity becomes a page boundary

- **GIVEN** a current producer issues a cursor for a schema-admitted UUID6/7/8 report
- **WHEN** the next query consumes that issued cursor
- **THEN** it accepts its identity under the same UUID admission contract
- **AND** existing UUID4/5 coordinates and privacy/integrity controls remain
