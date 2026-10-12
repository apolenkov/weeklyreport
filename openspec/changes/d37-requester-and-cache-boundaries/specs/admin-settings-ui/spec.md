## ADDED Requirements

### Requirement: Organization identity fields contain meaningful content

The `admin.updateOrganization` input and shared stored/public organization projections MUST reject `shortName` or `fullName` containing only whitespace. Nonblank values MUST retain their original characters and existing length and HTML-delimiter limits.

#### Scenario: Direct API input cannot save a blank identity

- **WHEN** either organization name contains only spaces, tabs or line breaks
- **THEN** the shared input validator rejects it before the organization write
- **AND** stored and public validators enforce the same boundary

#### Scenario: Nonblank names retain their content

- **WHEN** a valid organization name contains meaningful content and surrounding spaces
- **THEN** validation preserves its original characters
