## ADDED Requirements

### Requirement: Activity persisted text uses its existing write format guard

ProjectActivity name and each jiraAccounts element MUST use the existing safeText format guard at read/create/update boundaries with their unchanged name200 and account100 bounds. Successful parsed strings MUST retain their exact input bytes. Existing read defaults/readonly and cardinality/UUID policies MUST remain unchanged.

#### Scenario: Malformed persisted display text

- **WHEN** Activity read parsing receives whitespace-only, canonical zero-width-only or null-byte text in name or a Jira account
- **THEN** the owning shared parser rejects that field

#### Scenario: Visible persisted text retains compatibility

- **WHEN** Activity read parsing receives visible surrounding spaces, multiline text or exact maximum length
- **THEN** its accepted string bytes and existing collection contracts remain unchanged
