## ADDED Requirements

### Requirement: The feedback inbox MUST order a thread like the session snapshot

Every inbox projection of an annotation thread, in the list and in the
responses of edit, status and dismiss actions, MUST order thread messages by
timestamp and then by server ID, the same order as the session snapshot.

#### Scenario: replies share a millisecond

- **WHEN** several replies on one annotation carry the same timestamp
- **THEN** the inbox lists them in the same order as the session snapshot
- **AND** that order is ascending by server ID

#### Scenario: replies carry different timestamps

- **WHEN** replies carry different timestamps
- **THEN** the inbox lists them in ascending timestamp order, regardless of
  insertion order
