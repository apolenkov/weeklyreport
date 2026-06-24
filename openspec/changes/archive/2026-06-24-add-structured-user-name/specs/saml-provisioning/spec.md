# saml-provisioning

SAML/Keycloak is registration-only: it authenticates and minimally registers a
person on first login, then never re-syncs. Roles are admin-assigned, not
IdP-asserted.

## ADDED Requirements

### Requirement: First login creates a minimal stub

SAML login SHALL create a missing user as a stub with `role = viewer` and
`name = displayName`. The structured name parts are required columns the
assertion cannot supply, so the stub synthesizes them: `lastName` = the whole
`displayName` (the IdP name order is not guessed), `firstName` = a placeholder
the admin replaces, and `middleName` / `position` = `null`. Real ФИО parts,
`position`, and `role` are admin-maintained afterwards.

#### Scenario: unknown user registers

- **WHEN** a person with no existing user logs in via SAML
- **THEN** a user is created with `name = profile.displayName`
- **AND** `role = "viewer"`
- **AND** `lastName = profile.displayName`, `firstName` is a placeholder, and
  `middleName` / `position` are `null`

### Requirement: Existing users are never re-synced from the IdP

SAML login MUST NOT overwrite an existing user's `name`, `role`,
`reportingGroupId`, name parts, or `position`. After first registration the
stored record is the source of truth.

#### Scenario: returning user keeps admin-authored profile

- **WHEN** an existing user whose admin set ФИО parts, `role = "lead"`, and a
  `position` logs in again via SAML
- **THEN** none of `name`, parts, `role`, `reportingGroupId`, or `position` are
  changed by the login

### Requirement: Role is not carried by the assertion

The SAML assertion schema SHALL NOT include or require `role`; `SamlProfileSchema`
and `verifySamlProfile` MUST drop the role attribute, and every SAML-provisioned
user defaults to `viewer`. Roles are assigned only by the admin.

#### Scenario: assertion without role parses

- **WHEN** a Keycloak assertion with no role attribute is verified
- **THEN** verification succeeds
- **AND** the provisioned user is `viewer`

#### Scenario: dev-login is unaffected

- **WHEN** dev-login (`AUTH_DEV_MODE`) is used
- **THEN** its role still comes from its own query parameter, not
  `SamlProfileSchema`

### Requirement: Account key is the corporate email

The account SHALL be keyed by the corporate email, which is also the `samlId`;
there is no separate username and no corporate-domain allow-list on the email.

#### Scenario: email identifies the account

- **WHEN** a user is provisioned via SAML
- **THEN** the corporate email is the account key (== `samlId`)
- **AND** no separate username is stored and no domain allow-list is enforced
