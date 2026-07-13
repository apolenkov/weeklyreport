## ADDED Requirements

### Requirement: Search headline snippets are computed only over post-limit survivors

The full-text search repository MUST evaluate `ts_headline` only over the
rows that survive each UNION ALL chunk's rank-ordering and per-type `LIMIT`,
never over the full set of rows matching that chunk's `tsvector` predicate.
Each chunk MUST rank and limit first (over id, rank, and the raw document
text/expression, without `ts_headline`), then compute `ts_headline` in an
outer projection bounded to that already-limited row set. This MUST NOT
change the returned hits, snippet text, or ordering compared to computing
`ts_headline` before the limit — it only changes how many times the
expensive headline computation runs.

#### Scenario: A high-frequency term bounds headline computation to the limit

- **GIVEN** a search term whose `tsvector` predicate matches thousands of rows
  of one content type
- **WHEN** the search repository executes that chunk
- **THEN** `ts_headline` is computed at most `perType` times for that chunk,
  not once per matching row

#### Scenario: Deferring headline computation does not change search output

- **GIVEN** the same search parameters (`q`, `scope`, `groupIds`,
  `excludeTypes`, `limit`)
- **WHEN** the search is run against the post-limit `ts_headline` projection
- **THEN** the returned hits, their `snippet` text, and their order are
  identical to computing `ts_headline` before the rank-and-limit step
