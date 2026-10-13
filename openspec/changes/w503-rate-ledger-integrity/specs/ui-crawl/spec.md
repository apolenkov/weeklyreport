## ADDED Requirements

### Requirement: Shared request ledger rejects corrupt history

The crawler request reservation boundary MUST reject a persisted ledger row
unless it has exactly two integer fields: a nonnegative safe timestamp and a
signed safe request count. It MUST surface corruption before admitting a
request, preserve the original ledger bytes, and release its lock. An empty or
absent ledger MUST remain valid first-run history.

#### Scenario: Non-finite or malformed persisted row

- **WHEN** the crawler reserves a request using history with a non-finite field,
  missing or extra field, or malformed integer
- **THEN** reservation fails with an explicit ledger integrity error
- **AND** no request is admitted and the history is neither reset nor compacted

#### Scenario: Valid signed correction

- **WHEN** a completed action consumed fewer requests than it reserved
- **THEN** its signed correction remains part of the original minute's budget
- **AND** another reservation uses the corrected total

#### Scenario: First reservation

- **WHEN** the persisted ledger is empty or absent
- **THEN** reservation initializes history normally
