# saml-provisioning Specification

## Purpose

Define SAML create-only provisioning: a missing user is created as a
least-privilege viewer with synthesized name parts, and an existing user is never
overwritten (name / role / group / parts) on SAML login.

## Requirements

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

### Requirement: The asserted identity is nonblank

The `nameID` attribute SHALL be non-empty and contain at least one
non-whitespace character; a blank `nameID` MUST fail assertion verification
before any user lookup or provisioning. A verified `nameID` MUST be stored in
`User.samlId` exactly as asserted — never trimmed, case-folded, or normalized.
This verbatim-key requirement does not apply to the separate `User.email`, which
uses the canonical trim-and-lowercase form.

#### Scenario: whitespace-only identity is refused

- **WHEN** an assertion presents a `nameID` of whitespace characters only
- **THEN** the profile is rejected as an invalid assertion
- **AND** no user lookup or provisioning is attempted

### Requirement: Account key is the corporate email

Account resolution SHALL use the canonical corporate email identity in
`User.email` and the separate, verbatim asserted `nameID` in `User.samlId`.
Those values MUST NOT be required to be equal. An email miss MUST permit an exact
SAML-key lookup for the same existing identity; an email hit with a foreign SAML
key MUST be refused. There is no separate username and no corporate-domain
allow-list on the email.

#### Scenario: email identifies the account

- **WHEN** a user is provisioned via SAML
- **THEN** `User.email` is the corporate email in its trimmed, lowercase form
- **AND** `User.samlId` is the verified assertion's `nameID` byte-for-byte
- **AND** no equality between email and `samlId` is required
- **AND** no separate username is stored and no domain allow-list is enforced

### Requirement: Rejected SAML assertions are always audited and metered

The SAML callback route MUST record every rejected assertion — bad
signature, expired, or replay — in the audit log via `loginFail` and in the
`loginAttemptsTotal{outcome="fail"}` Prometheus counter, before redirecting
the user to the error page. The recording path MUST be reachable regardless
of whether Passport rejects the assertion internally or the application code
rejects it after Passport hands back a profile.

#### Scenario: An invalid assertion is audited and metered

- **WHEN** the SAML IdP callback presents an assertion that Passport rejects
  (bad signature, expired, or replay)
- **THEN** an audit entry is written via `loginFail` with
  `reason: "invalid_assertion"`
- **AND** `loginAttemptsTotal{method:"saml", outcome:"fail"}` is incremented
- **AND** the user is redirected to `/auth/error?reason=invalid_assertion`

#### Scenario: A valid assertion is not recorded as a failure

- **WHEN** the SAML IdP callback presents a valid, accepted assertion
- **THEN** no `loginFail` audit entry is written
- **AND** `loginAttemptsTotal{outcome:"fail"}` is not incremented

### Requirement: SAML signature verification is exercised as an integration boundary

The canonical API test suite MUST execute SAML response parsing with the pinned samlify dependency and checked-in test-only certificates. It MUST prove acceptance of a valid signed assertion and rejection of mutated signatures, an untrusted certificate, and replay.

#### Scenario: Valid test assertion is signed

- **WHEN** the integration test signs a complete assertion with the trusted test IdP key
- **THEN** the production SAML parser validates it and returns the expected corporate identity

#### Scenario: Signature bytes are mutated

- **WHEN** any signed assertion byte covered by the signature is changed after signing
- **THEN** parsing fails before provisioning and the rejected assertion is audited and metered

#### Scenario: Assertion uses an untrusted certificate

- **WHEN** a structurally valid assertion is signed by a different test certificate
- **THEN** parsing fails before provisioning

#### Scenario: Signed assertion is replayed

- **WHEN** the same accepted assertion identifier is submitted again within its validity window
- **THEN** the second request is rejected and recorded as a replay failure

### Requirement: SAML email resolution is case-insensitive

Account lookup by corporate email MUST compare case-insensitively as literal
addresses, including `_` and `%`. SAML provisioning MUST store canonical
`User.email` (trim + lowercase) on create. `User.samlId` lookup and storage MUST
remain exact and verbatim. An email hit with a different asserted SAML identity
MUST be refused without creating, updating, re-linking, or adopting a user.

#### Scenario: Case-variant assertion resolves the same account

- **GIVEN** a stored user with email `admin@example.test` and matching
  `samlId`
- **WHEN** a SAML assertion presents `Admin@Example.test` with the same
  `samlId`
- **THEN** the existing account is resolved and no new user is created

#### Scenario: Case-variant email with a foreign samlId is refused

- **GIVEN** a stored user with email `admin@example.test`
- **WHEN** a SAML assertion presents `Admin@Example.test` under a different
  `samlId`
- **THEN** the login is refused as an identity mismatch
- **AND** no user is created or updated

#### Scenario: Pattern characters in an address match literally

- **GIVEN** a stored user with email `a.b@example.test`
- **WHEN** a SAML assertion presents `a_b@example.test` under another
  `samlId`
- **THEN** the stored account is not matched and a separate account is
  provisioned
