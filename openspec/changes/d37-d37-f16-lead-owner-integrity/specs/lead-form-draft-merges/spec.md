## ADDED Requirements

### Requirement: Explicit completion clears obsolete completion state

The existing explicit completion command MUST mark the current owned draft row done and clear its paused reason, next-step commitment and carried confirmation marker without changing identity, comments, parent, stages or rank.

#### Scenario: A paused carried occurrence is completed

- **WHEN** the current draft completion command acts on an owned paused carried row
- **THEN** the same row is done, with no paused reason or next-step commitment and with carried confirmation cleared
- **AND** unrelated rows and durable identity remain unchanged in the outgoing draft

### Requirement: Unchanged stage input preserves the product fallback

A product stage merge MUST preserve the existing raw product traffic-light fallback when none of that product's owned stage statuses changed. An explicit stage change MUST continue to derive that product's traffic light from its owned stage statuses.

#### Scenario: A neighboring product changes

- **GIVEN** product A has all-null owned stages and a raw product fallback
- **WHEN** product B changes while A's stage values remain unchanged
- **THEN** A's fallback survives in the raw draft and outgoing payload

#### Scenario: A stage is explicitly cleared

- **WHEN** an owned stage status actually changes to empty
- **THEN** aggregation still reflects the changed owned-stage values, including a null aggregate

### Requirement: Decision deletion checks current edit permission

A decision deletion confirmation MUST check the current read-only state before calling the section's write callback. Cancel MUST remain inert.

#### Scenario: Permission changes while confirmation is open

- **WHEN** deletion confirmation opens while editable and the section becomes read-only before confirmation
- **THEN** confirmation closes without invoking the write callback
