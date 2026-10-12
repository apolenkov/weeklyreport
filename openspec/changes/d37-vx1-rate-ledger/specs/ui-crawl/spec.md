## ADDED Requirements

### Requirement: Existing crawler request history fails closed

The crawler MUST treat only an absent request ledger as empty history. Other read failures MUST preserve their cause and prevent another reservation from being appended. Valid signed corrections MUST retain the existing request-budget semantics.

#### Scenario: Existing history is writable but unreadable

- **WHEN** the crawler cannot read existing rate history although appending would succeed
- **THEN** it reports the original filesystem error and adds no reservation

#### Scenario: First request has no ledger

- **WHEN** the request ledger is absent
- **THEN** the crawler can reserve within the existing budget and create its history

#### Scenario: A reservation consumed fewer requests

- **WHEN** a measured request count is less than its reservation
- **THEN** its negative correction retains the existing budget refund
