## ADDED Requirements

### Requirement: Action Log remains readable at narrow widths

The Actions surface at `/admin?tab=actions` MUST keep each event's timestamp,
actor, procedure, result, and safe-detail disclosure reachable at 375 CSS
pixels without clipped meaningful text or document-level horizontal overflow.
Secondary technical columns MAY be hidden at narrow widths only when their
full allowlisted values remain available through the existing safe-detail
disclosure. Internal horizontal overflow MUST have a visible scroll cue.
The UI MAY show an actor name only from an already available Admin user
snapshot matched by exact user ID; otherwise it MUST display the event's UUID.
Names MUST NOT replace actor IDs in durable events, raw details, or copy output,
and this presentation MUST NOT add a snapshot query or change the audit API.

#### Scenario: An Admin inspects a mobile event

- **WHEN** an Admin opens Actions at 375 CSS pixels
- **THEN** event identity, procedure, result, and its safe-detail control remain readable and reachable
- **AND** expanding details still exposes every full allowlisted value

#### Scenario: An actor name is already available

- **WHEN** an already loaded Admin snapshot contains the event actor's exact user ID
- **THEN** the row may show that user's existing display name
- **AND** the event UUID remains available in details and copy output

#### Scenario: Actions opens without a user snapshot

- **WHEN** direct Actions navigation has no matching already loaded user name
- **THEN** the row shows the actor UUID without fetching names or inventing an identity
