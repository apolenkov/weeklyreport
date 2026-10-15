## ADDED Requirements

### Requirement: Published search orders ties identically before the limit and in the response

Published search SHALL order matching documents by rank descending, then
`createdAt` descending, then record id ascending, and SHALL apply the result
limit after that order. Rows that share a record id SHALL be ordered by report
id and record type ascending so the order is deterministic. The returned list
SHALL be the first N rows of this order, not a re-sorted subset chosen by a
different order.

#### Scenario: A tie straddles the limit

- **GIVEN** a published report with three matching records of equal rank and
  creation time
- **WHEN** a search with limit 2 runs
- **THEN** the two records with the smallest ids are returned, in ascending id order

#### Scenario: The limit covers every tied record

- **GIVEN** the same three records
- **WHEN** a search with limit 3 runs
- **THEN** all three are returned in ascending id order
