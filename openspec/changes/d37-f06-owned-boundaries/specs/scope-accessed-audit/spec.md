## ADDED Requirements

### Requirement: Human audit actor fields share one runtime whitelist

The current human audit event factories MUST derive userId, role and ip from one exact runtime whitelist owner. No additional caller field may enter an event through actor projection. Existing event-specific fields, optional guards, levels and cron identity remain unchanged.

#### Scenario: Caller supplies additional fields

- **WHEN** a current human audit event receives additional caller fields
- **THEN** the actor projection emits only userId, role and ip
- **AND** the event retains its existing explicitly selected event-specific fields
