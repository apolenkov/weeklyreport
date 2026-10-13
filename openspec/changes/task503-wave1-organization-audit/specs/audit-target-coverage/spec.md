## ADDED Requirements

### Requirement: Organization identity audit captures the committed transition

For successful `admin.updateOrganization`, the structured `admin.organization.update` audit MUST record the identity immediately preceding that committed write and its resulting identity. A failed write MUST NOT emit a successful organization identity event. The existing Organization response DTO and durable UserActionLog allowlist MUST remain unchanged.

#### Scenario: An intervening organization save wins before the delayed write

- **GIVEN** Organization has identity Initial and admin request A is delayed before its atomic update
- **WHEN** admin request B commits identity B, then A commits identity A
- **THEN** A's structured audit records previous identity B and next identity A
- **AND** the response contains only the resulting Organization DTO

#### Scenario: The singleton is absent

- **WHEN** an admin attempts to update a missing Organization singleton
- **THEN** the write fails without creating the singleton or emitting a successful identity audit
