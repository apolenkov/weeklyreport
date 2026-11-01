## ADDED Requirements

### Requirement: Mutation audit target extraction is bounded

Target extraction MUST read at most 8 levels of the decoded input, MUST visit each object once, and MUST report at most 20 distinct identities in `targets`. When any identity or branch is left out, the audit event MUST carry `truncated: true`. The primary `target` MUST stay the first identity in discovery order, and the durable audit row MUST be unchanged.

#### Scenario: more identities than the cap

- **WHEN** a mutation input names 25 distinct identities
- **THEN** the audit event lists the first 20 in discovery order, `target` is the first, and `truncated` is true

#### Scenario: input within the limits

- **WHEN** a mutation input names 3 identities within 8 levels
- **THEN** the audit event lists all 3 and carries no `truncated` field

#### Scenario: self-referencing input

- **WHEN** the decoded input refers back to one of its own objects
- **THEN** extraction completes, the mutation outcome is preserved, and each object is read once
